import {
  execFileSync,
  spawn,
} from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { Upload } from 'tus-js-client'

const localStatus = readLocalStatus()
const apiUrl = localStatus.API_URL
const serviceRoleKey = localStatus.SERVICE_ROLE_KEY
const publishableKey = localStatus.PUBLISHABLE_KEY ?? localStatus.ANON_KEY
const apiHost = new URL(apiUrl).hostname
const quarantineBucket = 'operational-attachments-quarantine'
const availableBucket = 'operational-attachments'

if (!['127.0.0.1', 'localhost'].includes(apiHost)) {
  throw new Error('Attachment integration tests must target local Supabase only.')
}

const admin = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const user = createClient(apiUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ids = {
  user: randomUUID(),
  organization: randomUUID(),
  member: randomUUID(),
  channel: randomUUID(),
  membership: randomUUID(),
  clientAttachment: randomUUID(),
  clientMessage: randomUUID(),
}
const email = `attachment-${ids.user}@example.test`
const password = 'Local-only-attachment-password-42!'
const fileName = 'large-handoff.pdf'
const fileBody = Buffer.alloc(7 * 1024 * 1024, 0x41)
let objectPath
let functionsProcess

try {
  functionsProcess = await ensureFunctionsReady()
  await expectData(
    admin.auth.admin.createUser({
      id: ids.user,
      email,
      password,
      email_confirm: true,
    }),
    'create local attachment user',
  )
  await insert('organizations', {
    id: ids.organization,
    name: 'Attachment Integration Clinic',
    slug: `attachment-${ids.organization}`,
  })
  await insert('profiles', {
    id: ids.user,
    full_name: 'Attachment Integration User',
    work_email: email,
  })
  await insert('organization_members', {
    id: ids.member,
    organization_id: ids.organization,
    user_id: ids.user,
  })
  await insert('channels', {
    id: ids.channel,
    organization_id: ids.organization,
    name: `attachment-${ids.channel}`,
    display_name: 'Attachment verification',
    purpose: 'Verify private resumable operational attachments.',
    type: 'department',
    owner_member_id: ids.member,
  })
  await insert('channel_memberships', {
    id: ids.membership,
    organization_id: ids.organization,
    channel_id: ids.channel,
    member_id: ids.member,
    source: 'policy',
  })

  const signedIn = await expectData(
    user.auth.signInWithPassword({ email, password }),
    'sign in local attachment user',
  )
  const sessionData = await expectData(
    user.auth.getSession(),
    'restore the local attachment password session',
  )
  const accessToken = sessionData.session?.access_token
  if (!accessToken || accessToken !== signedIn.session?.access_token) {
    throw new Error('The attachment password session is missing.')
  }

  const initialized = await expectData(
    user
      .rpc('create_attachment_upload', {
        target_channel_id: ids.channel,
        target_original_name: fileName,
        target_mime_type: 'application/pdf',
        target_size_bytes: fileBody.byteLength,
        target_client_attachment_id: ids.clientAttachment,
      })
      .single(),
    'initialize the private attachment',
  )
  objectPath = initialized.object_path

  const progress = []
  await uploadWithTus({
    accessToken,
    body: fileBody,
    objectPath,
    onProgress: (percentage) => progress.push(percentage),
  })
  if (!progress.some((percentage) => percentage > 0 && percentage < 100)) {
    throw new Error('The resumable upload did not report chunk progress.')
  }

  const finalized = await invokeFunction(
    'finalize-attachment-upload',
    accessToken,
    { attachmentId: initialized.id },
  )
  if (
    finalized.attachment?.status !== 'available'
    || finalized.attachment?.scan_status !== 'bypassed_dev'
  ) {
    throw new Error('The development promotion state was not recorded.')
  }

  const sentMessage = await expectData(
    user
      .rpc('send_message_with_attachments', {
        target_organization_id: ids.organization,
        target_channel_id: ids.channel,
        target_author_member_id: ids.member,
        target_client_message_id: ids.clientMessage,
        target_body: 'Shared the large attachment integration file.',
        target_is_urgent: false,
        target_attachment_ids: [initialized.id],
      })
      .single(),
    'send the message attachment atomically',
  )
  if (!sentMessage?.id) throw new Error('The message RPC returned no message.')
  const enrichedMessage = await expectData(
    user
      .from('messages')
      .select(`
        id,
        message_attachments(
          attachment:attachments(id, original_name, scan_status)
        )
      `)
      .eq('id', sentMessage.id)
      .single(),
    'read the linked attachment through the message relationship',
  )
  if (
    enrichedMessage.message_attachments?.[0]?.attachment?.id !== initialized.id
  ) {
    throw new Error('The message query did not return its linked attachment.')
  }

  const signedDownload = await invokeFunction(
    'create-attachment-download',
    accessToken,
    { attachmentId: initialized.id },
  )
  const downloadResponse = await fetch(new URL(signedDownload.url, apiUrl))
  if (!downloadResponse.ok) {
    throw new Error(`The signed attachment download returned HTTP ${downloadResponse.status}.`)
  }
  const downloaded = Buffer.from(await downloadResponse.arrayBuffer())
  if (!downloaded.equals(fileBody)) {
    throw new Error('The downloaded attachment bytes do not match the upload.')
  }

  const quarantineObjects = await expectData(
    admin.storage.from(quarantineBucket).list(
      objectPath.slice(0, objectPath.lastIndexOf('/')),
    ),
    'list the quarantine folder after promotion',
  )
  const availableObjects = await expectData(
    admin.storage.from(availableBucket).list(
      objectPath.slice(0, objectPath.lastIndexOf('/')),
    ),
    'list the available folder after promotion',
  )
  if (
    quarantineObjects.some((item) => item.name === 'original.pdf')
    || !availableObjects.some((item) => item.name === 'original.pdf')
  ) {
    throw new Error('Cross-bucket promotion did not remove the quarantine copy.')
  }

  console.log(
    'Local resumable upload, development promotion, atomic send, and signed download passed.',
  )
} finally {
  await cleanup()
  stopFunctions(functionsProcess)
}

async function uploadWithTus({ accessToken, body, objectPath, onProgress }) {
  await new Promise((resolveUpload, rejectUpload) => {
    const upload = new Upload(body, {
      endpoint: `${apiUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: publishableKey,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      uploadSize: body.byteLength,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: quarantineBucket,
        objectName: objectPath,
        contentType: 'application/pdf',
        cacheControl: '0',
      },
      onProgress: (uploaded, total) => {
        onProgress(Math.round((uploaded / total) * 100))
      },
      onError: rejectUpload,
      onSuccess: resolveUpload,
    })
    upload.start()
  })
}

async function invokeFunction(functionName, accessToken, body) {
  const response = await fetch(`${apiUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) {
    throw new Error(
      `${functionName} failed: ${result.error ?? `HTTP ${response.status}`}`,
    )
  }
  return result
}

async function insert(table, values) {
  await expectData(admin.from(table).insert(values), `insert ${table}`)
}

async function expectData(request, operation) {
  const { data, error } = await request
  if (error) throw new Error(`${operation} failed: ${error.message}`)
  return data
}

async function cleanup() {
  if (objectPath) {
    await admin.storage.from(quarantineBucket).remove([objectPath])
    await admin.storage.from(availableBucket).remove([objectPath])
  }
  const deletions = [
    admin.from('audit_events').delete().eq('organization_id', ids.organization),
    admin.from('messages').delete().eq('organization_id', ids.organization),
    admin.from('attachments').delete().eq('organization_id', ids.organization),
    admin.from('channel_memberships').delete().eq('organization_id', ids.organization),
    admin.from('channels').delete().eq('organization_id', ids.organization),
    admin.from('organization_members').delete().eq('organization_id', ids.organization),
    admin.from('profiles').delete().eq('id', ids.user),
    admin.from('organizations').delete().eq('id', ids.organization),
  ]
  for (const deletion of deletions) await deletion
  await admin.auth.admin.deleteUser(ids.user)
}

async function ensureFunctionsReady() {
  const executable = supabaseExecutable()
  const env = { ...process.env, ATTACHMENT_SCAN_MODE: 'dev_bypass' }
  const processHandle = process.platform === 'win32'
    ? spawn(
        process.env.ComSpec ?? 'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          `${executable} functions serve --env-file supabase/functions/.env.test`,
        ],
        { env, stdio: 'ignore', windowsHide: true },
      )
    : spawn(executable, [
        'functions',
        'serve',
        '--env-file',
        'supabase/functions/.env.test',
      ], {
        env,
        stdio: 'ignore',
      })

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await functionsAreReady()) {
      await delay(2_500)
      return processHandle
    }
    if (processHandle.exitCode !== null) {
      throw new Error('The local Edge Functions runtime stopped unexpectedly.')
    }
    await delay(500)
  }
  stopFunctions(processHandle)
  throw new Error('The local Edge Functions runtime did not become ready.')
}

async function functionsAreReady() {
  try {
    const response = await fetch(
      `${apiUrl}/functions/v1/finalize-attachment-upload`,
      { method: 'OPTIONS' },
    )
    return response.ok
  } catch {
    return false
  }
}

function stopFunctions(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return
  if (process.platform === 'win32') {
    execFileSync(
      'taskkill',
      ['/pid', String(processHandle.pid), '/T', '/F'],
      { stdio: 'ignore' },
    )
    return
  }
  processHandle.kill('SIGTERM')
}

function readLocalStatus() {
  const executable = supabaseExecutable()
  const command = process.platform === 'win32'
    ? (process.env.ComSpec ?? 'cmd.exe')
    : executable
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `${executable} status --output json`]
    : ['status', '--output', 'json']
  const output = execFileSync(
    command,
    args,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  return JSON.parse(output)
}

function supabaseExecutable() {
  return resolve(
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
  )
}

function delay(duration) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, duration))
}
