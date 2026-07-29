import { createHmac, randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const roleValues = new Set([
  'owner',
  'org_admin',
  'location_manager',
  'department_lead',
  'staff',
  'contractor',
  'it_support',
])

export async function provisionAccounts(manifest, options = {}) {
  const url = process.env.SUPABASE_URL ?? process.env.API_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SERVICE_ROLE_KEY
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.ANON_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before provisioning.',
    )
  }
  if (manifest.testAccounts && manifest.environment !== 'development') {
    throw new Error('Synthetic test accounts are development-only.')
  }
  if (
    manifest.environment === 'production'
    && process.env.ALLOW_PRODUCTION_PROVISIONING !== 'true'
  ) {
    throw new Error(
      'Set ALLOW_PRODUCTION_PROVISIONING=true for an approved production run.',
    )
  }

  const outputPath =
    options.outputPath
    ?? (manifest.testAccounts
      ? '.test-accounts.local.json'
      : '.employee-accounts.local.json')
  const existingSecrets = await readJsonIfPresent(outputPath)
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const organization = await upsertOrganization(admin, manifest.organization)
  const locations = await upsertLocations(
    admin,
    organization.id,
    manifest.locations ?? [],
  )
  const departments = await upsertDepartments(
    admin,
    organization.id,
    manifest.departments ?? [],
  )
  const users = await listAllUsers(admin)
  const credentials = {
    generatedAt: new Date().toISOString(),
    projectUrl: url,
    organizationSlug: manifest.organization.slug,
    accounts: {},
  }
  const members = new Map()

  for (const account of manifest.accounts) {
    validateAccount(account)
    const saved = existingSecrets?.accounts?.[account.key]
    const password =
      account.password
      ?? saved?.password
      ?? generatePassword()
    let user = users.find(
      (candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase(),
    )
    if (!user) {
      const created = await admin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName },
      })
      assertNoError(created.error, `create Auth user ${account.email}`)
      user = created.data.user
      users.push(user)
    } else if (account.resetPassword === true) {
      const updated = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName },
      })
      assertNoError(updated.error, `update Auth user ${account.email}`)
      user = updated.data.user
    }

    credentials.accounts[account.key] = {
      email: account.email,
      password,
      aal: account.aal ?? 'aal2',
      role: account.role ?? null,
      totpSecret: saved?.totpSecret ?? null,
    }

    if (account.outsider) continue
    await upsertProfile(admin, user.id, account)
    const member = await upsertMember(
      admin,
      organization.id,
      user.id,
      account,
    )
    members.set(account.key, member)
    await upsertOnboarding(admin, organization.id, member.id, account)
    await upsertPreferences(
      admin,
      organization.id,
      member.id,
      account,
      locations,
    )
    await replaceAssignments(
      admin,
      organization.id,
      member.id,
      account.assignments ?? [],
      locations,
      departments,
    )
    await replaceRole(
      admin,
      organization.id,
      member.id,
      account,
      locations,
      departments,
    )
  }

  const channels = await upsertChannels(
    admin,
    organization.id,
    manifest.channels ?? [],
    locations,
    departments,
    members,
  )
  await replaceChannelMemberships(
    admin,
    organization.id,
    manifest.accounts,
    channels,
    members,
  )

  for (const account of manifest.accounts) {
    const credential = credentials.accounts[account.key]
    const user = users.find(
      (candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase(),
    )
    if (!user) continue

    if (account.aal === 'bypass') {
      const expiresAt = new Date(Date.now() + 6 * 86_400_000).toISOString()
      const result = await admin.rpc('configure_development_mfa_bypass', {
        target_user_id: user.id,
        target_reason: 'Automated development test account',
        target_expires_at: expiresAt,
      })
      assertNoError(result.error, `configure MFA bypass for ${account.email}`)
      credential.bypassExpiresAt = expiresAt
    } else if (
      account.aal !== 'aal1'
      && publishableKey
    ) {
      credential.totpSecret = await ensureTotp(
        url,
        publishableKey,
        account.email,
        credential.password,
        credential.totpSecret,
      )
    }
  }

  await writeFile(outputPath, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  return {
    organizationId: organization.id,
    accountCount: manifest.accounts.length,
    outputPath,
  }
}

async function upsertOrganization(admin, organization) {
  const result = await admin
    .from('organizations')
    .upsert({
      name: organization.name,
      slug: organization.slug,
      short_name: organization.shortName ?? organization.name,
      legal_name: organization.legalName ?? organization.name,
      default_locale: organization.defaultLocale ?? 'vi-VN',
      timezone: organization.timezone ?? 'Asia/Ho_Chi_Minh',
      archived_at: null,
    }, { onConflict: 'slug' })
    .select('id')
    .single()
  assertNoError(result.error, 'upsert organization')
  return result.data
}

async function upsertLocations(admin, organizationId, definitions) {
  const result = new Map()
  for (const location of definitions) {
    const response = await admin
      .from('locations')
      .upsert({
        organization_id: organizationId,
        name: location.name,
        short_name: location.shortName,
        address: location.address ?? '',
        timezone: location.timezone ?? 'Asia/Ho_Chi_Minh',
        status: location.status ?? 'active',
        archived_at: null,
      }, { onConflict: 'organization_id,short_name' })
      .select('id, name, short_name, timezone')
      .single()
    assertNoError(response.error, `upsert location ${location.key}`)
    result.set(location.key, response.data)
  }
  return result
}

async function upsertDepartments(admin, organizationId, definitions) {
  const result = new Map()
  for (const department of definitions) {
    const response = await admin
      .from('departments')
      .upsert({
        organization_id: organizationId,
        name: department.name,
        code: department.code ?? department.key.toUpperCase(),
        archived_at: null,
      }, { onConflict: 'organization_id,name' })
      .select('id, name')
      .single()
    assertNoError(response.error, `upsert department ${department.key}`)
    result.set(department.key, response.data)
  }
  return result
}

async function upsertProfile(admin, userId, account) {
  const response = await admin
    .from('profiles')
    .upsert({
      id: userId,
      full_name: account.fullName,
      work_email: account.email,
      locale: account.locale ?? 'vi-VN',
    }, { onConflict: 'id' })
  assertNoError(response.error, `upsert profile ${account.email}`)
}

async function upsertMember(admin, organizationId, userId, account) {
  const response = await admin
    .from('organization_members')
    .upsert({
      organization_id: organizationId,
      user_id: userId,
      status: account.status ?? 'active',
      employment_type: account.employmentType ?? 'employee',
      starts_at: account.startsAt ?? new Date().toISOString(),
      expires_at: account.expiresAt ?? null,
      archived_at: null,
    }, { onConflict: 'organization_id,user_id' })
    .select('id')
    .single()
  assertNoError(response.error, `upsert membership ${account.email}`)
  return response.data
}

async function upsertOnboarding(admin, organizationId, memberId, account) {
  const response = await admin
    .from('onboarding_progress')
    .upsert({
      organization_id: organizationId,
      member_id: memberId,
      status: 'complete',
      accepted_policy_version: 'manual-provisioning-2026-07',
      accepted_policy_at: new Date().toISOString(),
      locale: account.locale ?? 'vi-VN',
      quiet_hours_start: account.quietHoursStart ?? null,
      quiet_hours_end: account.quietHoursEnd ?? null,
      notifications_enabled: account.notificationsEnabled ?? false,
    }, { onConflict: 'member_id' })
  assertNoError(response.error, `complete onboarding ${account.email}`)
}

async function upsertPreferences(
  admin,
  organizationId,
  memberId,
  account,
  locations,
) {
  const defaultLocation = account.defaultLocation
    ? requireMapValue(locations, account.defaultLocation, 'location')
    : null
  const response = await admin
    .from('account_preferences')
    .upsert({
      organization_id: organizationId,
      member_id: memberId,
      locale: account.locale ?? 'vi-VN',
      default_location_id: defaultLocation?.id ?? null,
      notifications_enabled: account.notificationsEnabled ?? false,
      quiet_hours_start: account.quietHoursStart ?? null,
      quiet_hours_end: account.quietHoursEnd ?? null,
      timezone:
        account.timezone
        ?? defaultLocation?.timezone
        ?? 'Asia/Ho_Chi_Minh',
    }, { onConflict: 'member_id' })
  assertNoError(response.error, `upsert preferences ${account.email}`)
}

async function replaceAssignments(
  admin,
  organizationId,
  memberId,
  definitions,
  locations,
  departments,
) {
  const existing = await admin
    .from('assignments')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('member_id', memberId)
    .is('archived_at', null)
  assertNoError(existing.error, 'load assignments')
  if (existing.data.length > 0) {
    const archived = await admin
      .from('assignments')
      .update({ archived_at: new Date().toISOString() })
      .in('id', existing.data.map((row) => row.id))
    assertNoError(archived.error, 'archive assignments')
  }
  if (definitions.length === 0) return
  const inserted = await admin.from('assignments').insert(
    definitions.map((definition) => ({
      organization_id: organizationId,
      member_id: memberId,
      location_id: requireMapValue(
        locations,
        definition.location,
        'location',
      ).id,
      department_id: requireMapValue(
        departments,
        definition.department,
        'department',
      ).id,
      is_primary: definition.primary === true,
      starts_at: definition.startsAt ?? new Date().toISOString(),
      ends_at: definition.endsAt ?? null,
    })),
  )
  assertNoError(inserted.error, 'replace assignments')
}

async function replaceRole(
  admin,
  organizationId,
  memberId,
  account,
  locations,
  departments,
) {
  if (!account.role) return
  const existing = await admin
    .from('role_bindings')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('member_id', memberId)
    .is('archived_at', null)
  assertNoError(existing.error, 'load role bindings')
  if (existing.data.length > 0) {
    const archived = await admin
      .from('role_bindings')
      .update({ archived_at: new Date().toISOString() })
      .in('id', existing.data.map((row) => row.id))
    assertNoError(archived.error, 'archive role bindings')
  }
  const created = await admin
    .from('role_bindings')
    .insert({
      organization_id: organizationId,
      member_id: memberId,
      role: account.role,
      starts_at: new Date().toISOString(),
      expires_at: account.roleExpiresAt ?? null,
    })
    .select('id')
    .single()
  assertNoError(created.error, `create role ${account.email}`)

  const locationScopes = (account.roleLocations ?? []).map((key) => ({
    organization_id: organizationId,
    role_binding_id: created.data.id,
    location_id: requireMapValue(locations, key, 'location').id,
  }))
  if (locationScopes.length > 0) {
    const response = await admin
      .from('role_binding_locations')
      .insert(locationScopes)
    assertNoError(response.error, 'create role location scopes')
  }
  const departmentScopes = (account.roleDepartments ?? []).map((key) => ({
    organization_id: organizationId,
    role_binding_id: created.data.id,
    department_id: requireMapValue(departments, key, 'department').id,
  }))
  if (departmentScopes.length > 0) {
    const response = await admin
      .from('role_binding_departments')
      .insert(departmentScopes)
    assertNoError(response.error, 'create role department scopes')
  }
}

async function upsertChannels(
  admin,
  organizationId,
  definitions,
  locations,
  departments,
  members,
) {
  const result = new Map()
  for (const channel of definitions) {
    const owner = requireMapValue(members, channel.owner, 'account')
    const existing = await admin
      .from('channels')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', channel.name)
      .is('archived_at', null)
      .maybeSingle()
    assertNoError(existing.error, `load channel ${channel.key}`)
    const payload = {
      organization_id: organizationId,
      name: channel.name,
      display_name: channel.displayName,
      purpose: channel.purpose,
      type: channel.type ?? 'department',
      visibility: channel.visibility ?? 'private',
      owner_member_id: owner.id,
      is_urgent: channel.urgent === true,
      archive_at: channel.archiveAt ?? null,
      archived_at: null,
    }
    const response = existing.data
      ? await admin
          .from('channels')
          .update(payload)
          .eq('id', existing.data.id)
          .select('id')
          .single()
      : await admin.from('channels').insert(payload).select('id').single()
    assertNoError(response.error, `upsert channel ${channel.key}`)
    result.set(channel.key, response.data)

    await replaceChannelScopes(
      admin,
      organizationId,
      response.data.id,
      channel,
      locations,
      departments,
    )
  }
  return result
}

async function replaceChannelScopes(
  admin,
  organizationId,
  channelId,
  channel,
  locations,
  departments,
) {
  for (const table of ['channel_locations', 'channel_departments']) {
    const deleted = await admin.from(table).delete().eq('channel_id', channelId)
    assertNoError(deleted.error, `clear ${table}`)
  }
  const locationRows = (channel.locations ?? []).map((key) => ({
    organization_id: organizationId,
    channel_id: channelId,
    location_id: requireMapValue(locations, key, 'location').id,
  }))
  if (locationRows.length > 0) {
    const response = await admin.from('channel_locations').insert(locationRows)
    assertNoError(response.error, 'create channel location scopes')
  }
  const departmentRows = (channel.departments ?? []).map((key) => ({
    organization_id: organizationId,
    channel_id: channelId,
    department_id: requireMapValue(departments, key, 'department').id,
  }))
  if (departmentRows.length > 0) {
    const response = await admin
      .from('channel_departments')
      .insert(departmentRows)
    assertNoError(response.error, 'create channel department scopes')
  }
}

async function replaceChannelMemberships(
  admin,
  organizationId,
  accounts,
  channels,
  members,
) {
  for (const account of accounts) {
    const member = members.get(account.key)
    if (!member) continue
    for (const [channelKey, access] of Object.entries(
      account.channelAccess ?? {},
    )) {
      const channel = requireMapValue(channels, channelKey, 'channel')
      const existing = await admin
        .from('channel_memberships')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('channel_id', channel.id)
        .eq('member_id', member.id)
        .is('archived_at', null)
        .maybeSingle()
      assertNoError(existing.error, 'load channel membership')
      const payload = {
        organization_id: organizationId,
        channel_id: channel.id,
        member_id: member.id,
        source: 'policy',
        can_send: access === 'send',
        starts_at: new Date().toISOString(),
        expires_at: account.channelAccessExpiresAt ?? null,
        archived_at: null,
      }
      const response = existing.data
        ? await admin
            .from('channel_memberships')
            .update(payload)
            .eq('id', existing.data.id)
        : await admin.from('channel_memberships').insert(payload)
      assertNoError(response.error, 'upsert channel membership')
    }
  }
}

async function ensureTotp(
  url,
  publishableKey,
  email,
  password,
  existingSecret,
) {
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signIn = await client.auth.signInWithPassword({ email, password })
  assertNoError(signIn.error, `sign in ${email} for TOTP enrollment`)
  const factors = await client.auth.mfa.listFactors()
  assertNoError(factors.error, `list TOTP factors for ${email}`)
  const verifiedFactor = factors.data.totp.find(
    (factor) => factor.status === 'verified',
  )
  if (verifiedFactor) {
    await client.auth.signOut()
    if (!existingSecret) {
      throw new Error(
        `The TOTP secret for ${email} is not in the local credentials file.`,
      )
    }
    return existingSecret
  }
  const enrolled = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Development test authenticator',
  })
  assertNoError(enrolled.error, `enroll TOTP for ${email}`)
  const secret = enrolled.data.totp.secret
  const challenged = await client.auth.mfa.challenge({
    factorId: enrolled.data.id,
  })
  assertNoError(challenged.error, `challenge TOTP for ${email}`)
  const verified = await client.auth.mfa.verify({
    factorId: enrolled.data.id,
    challengeId: challenged.data.id,
    code: totp(secret),
  })
  assertNoError(verified.error, `verify TOTP for ${email}`)
  await client.auth.signOut()
  return secret
}

async function listAllUsers(admin) {
  const users = []
  for (let page = 1; ; page += 1) {
    const response = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    assertNoError(response.error, 'list Auth users')
    users.push(...response.data.users)
    if (response.data.users.length < 1000) return users
  }
}

function validateAccount(account) {
  if (!account.key || !account.email || !account.fullName) {
    throw new Error('Each account needs key, email, and fullName values.')
  }
  if (account.role && !roleValues.has(account.role)) {
    throw new Error(`Unsupported role for ${account.email}: ${account.role}`)
  }
  if (
    Boolean(account.quietHoursStart)
    !== Boolean(account.quietHoursEnd)
  ) {
    throw new Error(`Quiet hours are incomplete for ${account.email}.`)
  }
}

function requireMapValue(map, key, type) {
  const value = map.get(key)
  if (!value) throw new Error(`Unknown ${type} key: ${key}`)
  return value
}

function assertNoError(error, action) {
  if (error) throw new Error(`Could not ${action}: ${error.message}`)
}

function generatePassword() {
  return `Yk!${randomBytes(18).toString('base64url')}9a`
}

function totp(secret) {
  const key = decodeBase32(secret)
  const counter = Math.floor(Date.now() / 30_000)
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', key).update(message).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const value = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  ) % 1_000_000
  return value.toString().padStart(6, '0')
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const character of value.replace(/=+$/u, '').toUpperCase()) {
    const index = alphabet.indexOf(character)
    if (index < 0) continue
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  }
  return Buffer.from(bytes)
}

async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function main() {
  const manifestArgument = process.argv.indexOf('--manifest')
  if (manifestArgument < 0 || !process.argv[manifestArgument + 1]) {
    throw new Error('Use --manifest <path> to select an account manifest.')
  }
  const outputArgument = process.argv.indexOf('--output')
  const manifest = JSON.parse(
    await readFile(process.argv[manifestArgument + 1], 'utf8'),
  )
  const result = await provisionAccounts(manifest, {
    outputPath:
      outputArgument >= 0 ? process.argv[outputArgument + 1] : undefined,
  })
  console.log(
    `Provisioned ${result.accountCount} accounts for ${result.organizationId}.`,
  )
  console.log(`Credentials were saved to ${result.outputPath}.`)
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main()
}
