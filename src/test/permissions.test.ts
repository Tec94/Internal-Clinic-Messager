import { describe, expect, it } from 'vitest'
import { channels, roleBindings } from '../data/seed'
import {
  canSendMessageInChannel,
  hasPermission,
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
