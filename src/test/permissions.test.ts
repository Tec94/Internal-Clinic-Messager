import { describe, expect, it } from 'vitest'
import { channels, roleBindings } from '../data/seed'
import type { Channel, RoleBinding, UserRole } from '../types/domain'
import {
  canAssignTaskTo,
  canSeeChannel,
  canSendMessageInChannel,
  hasOrganizationScope,
  hasPermission,
  isManager,
} from '../services/permissions'

describe('role-scoped permissions', () => {
  it('gives the owner organization-wide management access', () => {
    const owner = roleBindings.find((binding) => binding.role === 'owner')!
    expect(hasPermission(owner, 'manageOrganization')).toBe(true)
    expect(hasPermission(owner, 'sendOrganizationAnnouncement')).toBe(true)
  })

  it('gives a location manager scoped management permissions', () => {
    const manager = roleBindings.find(
      (binding) => binding.role === 'locationManager',
    )!
    expect(hasPermission(manager, 'managePeople')).toBe(true)
    expect(hasPermission(manager, 'sendOrganizationAnnouncement')).toBe(false)
  })

  it('gives a department lead scoped management permissions', () => {
    const lead = roleBindings.find(
      (binding) => binding.role === 'departmentLead',
    )!
    expect(hasPermission(lead, 'sendDepartmentAnnouncement')).toBe(true)
    expect(hasPermission(lead, 'viewAudit')).toBe(false)
  })

  it('allows active members to send in ordinary member channels', () => {
    const employee = roleBindings.find((binding) => binding.id === 'rb-employee')!
    const channel = channels.find((item) => item.id === 'front-desk-home')!
    expect(canSendMessageInChannel(employee, 'user-employee', channel)).toBe(true)
  })

  it('blocks nonmembers even when their role can see broad scope', () => {
    const owner = roleBindings.find((binding) => binding.role === 'owner')!
    const channel = channels.find((item) => item.id === 'front-desk-coverage')!
    expect(canSendMessageInChannel(owner, 'user-owner', channel)).toBe(false)
  })

  it('keeps announcement posting scoped to announcement authority', () => {
    const employee = roleBindings.find((binding) => binding.id === 'rb-employee')!
    const manager = roleBindings.find((binding) => binding.role === 'locationManager')!
    const announcement = channels.find((item) => item.id === 'clinic-announcements')!
    expect(canSendMessageInChannel(employee, 'user-employee', announcement)).toBe(false)
    expect(canSendMessageInChannel(manager, 'user-manager', announcement)).toBe(true)
  })

  it('blocks expired role bindings and contractor nonmember access', () => {
    const employee = roleBindings.find((binding) => binding.id === 'rb-employee')!
    const expired = { ...employee, expiresAt: '2026-01-01T00:00:00+07:00' }
    const contractor = roleBindings.find((binding) => binding.id === 'rb-contractor')!
    const channel = channels.find((item) => item.id === 'front-desk-home')!
    expect(canSendMessageInChannel(expired, 'user-employee', channel, new Date('2026-07-07T00:00:00+07:00'))).toBe(false)
    expect(canSendMessageInChannel(contractor, 'user-contractor', channel)).toBe(false)
  })
})

const binding = (role: UserRole): RoleBinding => ({
  id: `rb-${role}`, userId: 'self', role, organizationId: 'org', locationIds: ['loc-a'], departmentIds: ['dep-a'], startsAt: '2026-01-01',
})
const channel = (patch: Partial<Channel>): Channel => ({
  id: 'c', name: 'c', displayName: 'c', purpose: '', type: 'department', visibility: 'private',
  locationIds: ['loc-b'], departmentIds: [], ownerId: 'x', memberIds: [], unreadCount: 0, isUrgent: false, ...patch,
})

describe('Scope rules', () => {
  it.each<[UserRole, boolean, boolean]>([
    ['owner', true, true],
    ['orgAdmin', true, true],
    ['locationManager', true, false],
    ['departmentLead', true, false],
    ['staff', false, false],
    ['contractor', false, false],
    ['itSupport', false, false],
  ])('%s: Manager %s, Organization Scope %s', (role, manager, organization) => {
    expect(isManager({ role })).toBe(manager)
    expect(hasOrganizationScope({ role })).toBe(organization)
  })

  it.each<[UserRole, Partial<Channel>, boolean]>([
    ['owner', {}, true],
    ['orgAdmin', {}, true],
    ['locationManager', { locationIds: ['loc-a'] }, true],
    ['locationManager', { memberIds: ['self'], visibility: 'public' }, false],
    ['departmentLead', { locationIds: ['loc-a'], departmentIds: ['dep-a'] }, true],
    ['departmentLead', { locationIds: ['loc-a'], departmentIds: [] }, false],
    ['departmentLead', { locationIds: ['loc-a'], departmentIds: ['dep-b'] }, false],
    ['staff', { visibility: 'public' }, true],
    ['staff', { memberIds: ['self'] }, true],
    ['staff', { locationIds: ['loc-a'] }, false],
  ])('canSeeChannel %s %j -> %s', (role, patch, expected) => {
    expect(canSeeChannel(binding(role), channel(patch), 'self')).toBe(expected)
  })

  const assignments = [
    { userId: 'in-location', locationId: 'loc-a', departmentId: 'dep-b' },
    { userId: 'in-department', locationId: 'loc-b', departmentId: 'dep-a' },
  ]
  it.each<[UserRole, string, boolean]>([
    ['owner', 'anyone', true],
    ['orgAdmin', 'anyone', true],
    ['locationManager', 'in-location', true],
    ['locationManager', 'in-department', false],
    ['locationManager', 'self', false],
    ['departmentLead', 'in-department', true],
    ['departmentLead', 'in-location', false],
    ['staff', 'self', true],
    ['staff', 'in-location', false],
  ])('canAssignTaskTo %s -> %s is %s', (role, memberId, expected) => {
    expect(canAssignTaskTo(binding(role), memberId, 'self', assignments)).toBe(expected)
  })
})
