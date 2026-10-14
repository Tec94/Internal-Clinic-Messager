import type { Assignment, Channel, Permission, RoleBinding, UserRole } from '../types/domain'

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

// Presentation only (ADR-0002): RLS stays the authoritative check.
type Scoped = Pick<RoleBinding, 'role'>
const managerRoles: UserRole[] = ['owner', 'orgAdmin', 'locationManager', 'departmentLead']

export const isManager = (binding: Scoped) => managerRoles.includes(binding.role)

export const hasOrganizationScope = (binding: Scoped) =>
  binding.role === 'owner' || binding.role === 'orgAdmin'

export function canSeeChannel(binding: RoleBinding, channel: Channel, memberId: string) {
  if (hasOrganizationScope(binding)) return true
  const inAssignedLocation = channel.locationIds.some((locationId) => binding.locationIds.includes(locationId))
  if (binding.role === 'locationManager') return inAssignedLocation
  if (binding.role === 'departmentLead') return inAssignedLocation && channel.departmentIds.some((departmentId) => binding.departmentIds.includes(departmentId))
  return channel.visibility === 'public' || channel.memberIds.includes(memberId)
}

export function canAssignTaskTo(
  binding: RoleBinding,
  memberId: string,
  selfId: string,
  assignments: Pick<Assignment, 'userId' | 'locationId' | 'departmentId'>[],
) {
  if (!isManager(binding)) return memberId === selfId
  if (hasOrganizationScope(binding)) return true
  return assignments.some((assignment) => assignment.userId === memberId && (binding.role === 'locationManager'
    ? binding.locationIds.includes(assignment.locationId)
    : binding.departmentIds.includes(assignment.departmentId)))
}

function isActiveBinding(binding: RoleBinding, now = new Date()) {
  return !binding.expiresAt || new Date(binding.expiresAt) > now
}

export function canPostToAnnouncementChannel(binding: RoleBinding, channel: Channel) {
  if (hasOrganizationScope(binding)) return true
  const inAssignedLocation = channel.locationIds.some((locationId) =>
    binding.locationIds.includes(locationId),
  )
  const inAssignedDepartment =
    channel.departmentIds.length === 0 ||
    channel.departmentIds.some((departmentId) =>
      binding.departmentIds.includes(departmentId),
    )
  if (binding.role === 'locationManager') return inAssignedLocation
  if (binding.role === 'departmentLead') return inAssignedLocation && inAssignedDepartment
  return false
}

export function canSendMessageInChannel(
  binding: RoleBinding,
  userId: string,
  channel?: Channel,
  now = new Date(),
) {
  if (!channel || !isActiveBinding(binding, now)) return false
  if (!channel.memberIds.includes(userId)) return false
  if (channel.type === 'announcement') return canPostToAnnouncementChannel(binding, channel)
  return true
}
