import { describe, expect, it } from 'vitest'
import { roleBindings } from '../data/seed'
import {
  canAccessDepartment,
  canAccessLocation,
  getRolePermissions,
  hasPermission,
} from '../services/permissions'

describe('role-scoped permissions', () => {
  it('gives the owner organization-wide management access', () => {
    const owner = roleBindings.find((binding) => binding.role === 'owner')!
    expect(hasPermission(owner, 'manageOrganization')).toBe(true)
    expect(hasPermission(owner, 'sendOrganizationAnnouncement')).toBe(true)
    expect(canAccessLocation(owner, 'loc-b')).toBe(true)
  })

  it('limits a location manager to assigned locations', () => {
    const manager = roleBindings.find(
      (binding) => binding.role === 'locationManager',
    )!
    expect(hasPermission(manager, 'managePeople')).toBe(true)
    expect(hasPermission(manager, 'sendOrganizationAnnouncement')).toBe(false)
    expect(canAccessLocation(manager, 'loc-a')).toBe(true)
    expect(canAccessLocation(manager, 'loc-b')).toBe(false)
  })

  it('limits a department lead to assigned departments', () => {
    const lead = roleBindings.find(
      (binding) => binding.role === 'departmentLead',
    )!
    expect(hasPermission(lead, 'sendDepartmentAnnouncement')).toBe(true)
    expect(hasPermission(lead, 'viewAudit')).toBe(false)
    expect(canAccessDepartment(lead, 'front-desk')).toBe(true)
    expect(canAccessDepartment(lead, 'nursing')).toBe(false)
  })

  it('keeps regular staff out of the administrative control plane', () => {
    expect(getRolePermissions('staff')).toEqual([])
    expect(getRolePermissions('contractor')).toEqual([])
  })
})
