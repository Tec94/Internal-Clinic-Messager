import type { Permission, RoleBinding, UserRole } from '../types/domain'

const permissionMap: Record<UserRole, Permission[]> = {
  owner: [
    'viewAdmin',
    'manageOrganization',
    'manageLocations',
    'managePeople',
    'manageChannels',
    'sendOrganizationAnnouncement',
    'sendLocationAnnouncement',
    'sendDepartmentAnnouncement',
    'viewStaffing',
    'viewAudit',
    'manageIncidents',
  ],
  orgAdmin: [
    'viewAdmin',
    'manageLocations',
    'managePeople',
    'manageChannels',
    'sendOrganizationAnnouncement',
    'sendLocationAnnouncement',
    'sendDepartmentAnnouncement',
    'viewStaffing',
    'viewAudit',
    'manageIncidents',
  ],
  locationManager: [
    'viewAdmin',
    'manageLocations',
    'managePeople',
    'manageChannels',
    'sendLocationAnnouncement',
    'sendDepartmentAnnouncement',
    'viewStaffing',
    'viewAudit',
    'manageIncidents',
  ],
  departmentLead: [
    'viewAdmin',
    'managePeople',
    'manageChannels',
    'sendDepartmentAnnouncement',
    'viewStaffing',
  ],
  staff: [],
  contractor: [],
  itSupport: ['viewAdmin', 'manageChannels', 'viewAudit'],
}

export function hasPermission(binding: RoleBinding, permission: Permission) {
  return permissionMap[binding.role].includes(permission)
}

export function canAccessLocation(binding: RoleBinding, locationId: string) {
  return (
    binding.role === 'owner' ||
    binding.role === 'orgAdmin' ||
    binding.locationIds.includes(locationId)
  )
}

export function canAccessDepartment(
  binding: RoleBinding,
  departmentId: string,
) {
  return (
    binding.role === 'owner' ||
    binding.role === 'orgAdmin' ||
    binding.departmentIds.includes(departmentId)
  )
}

export function getRolePermissions(role: UserRole) {
  return [...permissionMap[role]]
}
