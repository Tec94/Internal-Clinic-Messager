import type {
  AccessRequest,
  Announcement,
  Assignment,
  Attachment,
  AuditEvent,
  Channel,
  ChannelMembership,
  Department,
  Location,
  Meeting,
  MeetingResponse,
  Message,
  Organization,
  RoleBinding,
  StaffingSnapshot,
  Task,
  User,
} from '../types/domain'

export const organization: Organization = {
  id: 'org-yksg',
  name: 'YKSG',
  shortName: 'YKSG',
  legalName: 'Phòng Khám Y Khoa Sài Gòn',
  defaultLocale: 'vi-VN',
  locationIds: ['loc-a', 'loc-b'],
}

export const locations: Location[] = [
  {
    id: 'loc-a',
    name: 'YKSG — Cơ sở Trung tâm',
    shortName: 'Cơ sở Trung tâm',
    address: 'Quận 1, Thành phố Hồ Chí Minh',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'active',
    departmentIds: ['front-desk', 'nursing', 'providers', 'billing', 'it'],
  },
  {
    id: 'loc-b',
    name: 'YKSG — Cơ sở phía Đông',
    shortName: 'Cơ sở phía Đông',
    address: 'Thành phố Thủ Đức, Thành phố Hồ Chí Minh',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'active',
    departmentIds: ['front-desk', 'nursing', 'providers', 'billing', 'it'],
  },
]

export const departments: Department[] = [
  { id: 'front-desk', name: 'Front Desk / Reception', code: 'FD', locationIds: ['loc-a', 'loc-b'] },
  { id: 'nursing', name: 'Clinical / Nursing', code: 'RN', locationIds: ['loc-a', 'loc-b'] },
  { id: 'providers', name: 'Providers', code: 'MD', locationIds: ['loc-a', 'loc-b'] },
  { id: 'billing', name: 'Billing / Administration', code: 'BA', locationIds: ['loc-a', 'loc-b'] },
  { id: 'it', name: 'Facilities / IT', code: 'IT', locationIds: ['loc-a', 'loc-b'] },
  { id: 'hr', name: 'People Operations', code: 'HR', locationIds: ['loc-a', 'loc-b'] },
]

export const roleBindings: RoleBinding[] = [
  { id: 'rb-owner', userId: 'user-owner', role: 'owner', organizationId: organization.id, locationIds: ['loc-a', 'loc-b'], departmentIds: departments.map((item) => item.id), startsAt: '2024-01-01T09:00:00+07:00' },
  { id: 'rb-manager', userId: 'user-manager', role: 'locationManager', organizationId: organization.id, locationIds: ['loc-a'], departmentIds: ['front-desk', 'nursing', 'providers', 'billing', 'it'], startsAt: '2025-02-10T09:00:00+07:00' },
  { id: 'rb-lead', userId: 'user-lead', role: 'departmentLead', organizationId: organization.id, locationIds: ['loc-a'], departmentIds: ['front-desk'], startsAt: '2025-06-01T09:00:00+07:00' },
  { id: 'rb-employee', userId: 'user-employee', role: 'staff', organizationId: organization.id, locationIds: ['loc-a'], departmentIds: ['front-desk'], startsAt: '2025-09-08T09:00:00+07:00' },
  { id: 'rb-float', userId: 'user-float', role: 'staff', organizationId: organization.id, locationIds: ['loc-a', 'loc-b'], departmentIds: ['front-desk', 'nursing'], startsAt: '2025-10-12T09:00:00+07:00' },
  { id: 'rb-contractor', userId: 'user-contractor', role: 'contractor', organizationId: organization.id, locationIds: ['loc-a'], departmentIds: ['it'], startsAt: '2026-06-01T09:00:00+07:00', expiresAt: '2026-08-01T17:00:00+07:00' },
]

export const assignments: Assignment[] = [
  { id: 'as-owner', userId: 'user-owner', locationId: 'loc-a', departmentId: 'hr', employmentType: 'fullTime', isPrimary: true, startsAt: '2024-01-01T09:00:00+07:00' },
  { id: 'as-manager', userId: 'user-manager', locationId: 'loc-a', departmentId: 'billing', employmentType: 'fullTime', isPrimary: true, startsAt: '2025-02-10T09:00:00+07:00' },
  { id: 'as-lead', userId: 'user-lead', locationId: 'loc-a', departmentId: 'front-desk', employmentType: 'fullTime', isPrimary: true, startsAt: '2025-06-01T09:00:00+07:00' },
  { id: 'as-employee', userId: 'user-employee', locationId: 'loc-a', departmentId: 'front-desk', employmentType: 'fullTime', isPrimary: true, startsAt: '2025-09-08T09:00:00+07:00' },
  { id: 'as-float-a', userId: 'user-float', locationId: 'loc-a', departmentId: 'front-desk', employmentType: 'perDiem', isPrimary: true, startsAt: '2025-10-12T09:00:00+07:00' },
  { id: 'as-float-b', userId: 'user-float', locationId: 'loc-b', departmentId: 'nursing', employmentType: 'perDiem', isPrimary: false, startsAt: '2025-10-12T09:00:00+07:00' },
  { id: 'as-contractor', userId: 'user-contractor', locationId: 'loc-a', departmentId: 'it', employmentType: 'contractor', isPrimary: true, startsAt: '2026-06-01T09:00:00+07:00', endsAt: '2026-08-01T17:00:00+07:00' },
]

export const users: User[] = [
  { id: 'user-owner', name: 'Nguyễn Minh Khang', initials: 'MK', title: 'Chủ phòng khám', email: 'minh.khang@yksg.example', presence: 'online', roleBindingIds: ['rb-owner'], assignmentIds: ['as-owner'] },
  { id: 'user-manager', name: 'Trần Thu Hà', initials: 'TH', title: 'Quản lý cơ sở', email: 'thu.ha@yksg.example', presence: 'online', roleBindingIds: ['rb-manager'], assignmentIds: ['as-manager'] },
  { id: 'user-lead', name: 'Lê Hoàng Anh', initials: 'HA', title: 'Trưởng nhóm lễ tân', email: 'hoang.anh@yksg.example', presence: 'online', roleBindingIds: ['rb-lead'], assignmentIds: ['as-lead'] },
  { id: 'user-employee', name: 'Phạm Ngọc Linh', initials: 'NL', title: 'Điều phối viên dịch vụ', email: 'ngoc.linh@yksg.example', presence: 'away', roleBindingIds: ['rb-employee'], assignmentIds: ['as-employee'] },
  { id: 'user-float', name: 'Võ Thành Nam', initials: 'TN', title: 'Điều phối viên luân phiên', email: 'thanh.nam@yksg.example', presence: 'online', roleBindingIds: ['rb-float'], assignmentIds: ['as-float-a', 'as-float-b'] },
  { id: 'user-contractor', name: 'Đỗ Minh Quân', initials: 'MQ', title: 'Nhà thầu CNTT', email: 'minh.quan@vendor.example', presence: 'offline', roleBindingIds: ['rb-contractor'], assignmentIds: ['as-contractor'] },
]

export const channels: Channel[] = [
  { id: 'front-desk-home', name: 'front-desk-home', displayName: 'Lễ tân — công việc chung', purpose: 'Điều phối công việc hằng ngày của lễ tân tại Cơ sở Trung tâm.', type: 'department', visibility: 'private', locationIds: ['loc-a'], departmentIds: ['front-desk'], ownerId: 'user-lead', memberIds: ['user-owner', 'user-manager', 'user-lead', 'user-employee', 'user-float'], unreadCount: 2, isUrgent: false, isPinned: true },
  { id: 'front-desk-coverage', name: 'front-desk-coverage', displayName: 'Điều phối nhân sự lễ tân', purpose: 'Thay đổi phân công và điều phối lễ tân trong ngày.', type: 'department', visibility: 'private', locationIds: ['loc-a'], departmentIds: ['front-desk'], ownerId: 'user-lead', memberIds: ['user-manager', 'user-lead', 'user-employee', 'user-float'], unreadCount: 1, isUrgent: true },
  { id: 'same-day-schedule', name: 'same-day-schedule-dr-nguyen', displayName: 'Lịch trong ngày — Bác sĩ Nguyễn', purpose: 'Giải quyết thay đổi lịch tại Cơ sở Trung tâm mà không đưa thông tin người bệnh.', type: 'interface', visibility: 'restricted', locationIds: ['loc-a'], departmentIds: ['front-desk', 'nursing'], ownerId: 'user-manager', memberIds: ['user-manager', 'user-lead', 'user-employee', 'user-float'], unreadCount: 1, isUrgent: false, archiveAt: '2026-07-07T17:00:00+07:00' },
  { id: 'same-day-lab-drop', name: 'interface-same-day-lab-drop', displayName: 'Bàn giao xét nghiệm trong ngày', purpose: 'Kênh phối hợp thường trực giữa lễ tân và điều dưỡng.', type: 'interface', visibility: 'restricted', locationIds: ['loc-a'], departmentIds: ['front-desk', 'nursing'], ownerId: 'user-manager', memberIds: ['user-manager', 'user-lead', 'user-employee', 'user-float'], unreadCount: 0, isUrgent: false },
  { id: 'clinic-announcements', name: 'clinic-announcements', displayName: 'Thông báo YKSG', purpose: 'Thông báo vận hành cho toàn bộ nhân sự.', type: 'announcement', visibility: 'public', locationIds: ['loc-a', 'loc-b'], departmentIds: [], ownerId: 'user-owner', memberIds: users.map((item) => item.id), unreadCount: 0, isUrgent: false },
  { id: 'exec-briefing', name: 'exec-briefing', displayName: 'Trao đổi ban điều hành', purpose: 'Không gian điều phối riêng của ban điều hành YKSG.', type: 'leadership', visibility: 'private', locationIds: ['loc-a', 'loc-b'], departmentIds: [], ownerId: 'user-owner', memberIds: ['user-owner', 'user-manager'], unreadCount: 2, isUrgent: false },
  { id: 'incident-triage-a', name: 'incident-triage-staffing-a', displayName: 'Sự cố — thiếu nhân sự điều dưỡng', purpose: 'Phòng điều phối tạm thời cho khoảng trống nhân sự tại Cơ sở Trung tâm.', type: 'incident', visibility: 'private', locationIds: ['loc-a'], departmentIds: ['nursing', 'providers'], ownerId: 'user-manager', memberIds: ['user-owner', 'user-manager', 'user-float'], unreadCount: 1, isUrgent: true, archiveAt: '2026-07-08T17:00:00+07:00' },
]

export const attachments: Attachment[] = [
  { id: 'attachment-sop', name: 'Quy trình điều chỉnh lịch.pdf', type: 'application/pdf', sizeLabel: '123 KB', uploadedBy: 'user-manager', uploadedAt: '2026-07-06T09:10:00+07:00', channelId: 'same-day-schedule', messageId: 'msg-7', taskId: 'task-schedule' },
  { id: 'attachment-guide', name: 'Hướng dẫn bàn giao lễ tân.pdf', type: 'application/pdf', sizeLabel: '248 KB', uploadedBy: 'user-lead', uploadedAt: '2026-07-06T08:42:00+07:00', channelId: 'front-desk-home', messageId: 'msg-1', taskId: 'task-terminal' },
]

export const messages: Message[] = [
  { id: 'msg-1', channelId: 'front-desk-home', authorId: 'user-lead', body: 'Chào buổi sáng. Hướng dẫn bàn giao mới đã được cập nhật để mọi người cùng sử dụng.', createdAt: '2026-07-06T08:42:00+07:00', isUrgent: false, attachmentIds: ['attachment-guide'] },
  { id: 'msg-2', channelId: 'front-desk-home', authorId: 'user-employee', body: 'Cần hỗ trợ tại quầy số 3. Máy check-in B đang bị treo và hàng chờ đang dài hơn.', createdAt: '2026-07-06T08:55:00+07:00', isUrgent: true, attachmentIds: [], taskId: 'task-terminal' },
  { id: 'msg-3', channelId: 'front-desk-home', authorId: 'user-contractor', body: 'Tôi đang kiểm tra. Tạm thời hướng dẫn nhân viên sử dụng máy A.', createdAt: '2026-07-06T08:58:00+07:00', isUrgent: false, attachmentIds: [] },
  { id: 'msg-meeting', channelId: 'front-desk-home', authorId: 'user-lead', body: 'Họp bàn giao lễ tân lúc 10:00 ngày 07/07/2026. https://meet.google.com/yksg-demo-room', createdAt: '2026-07-06T09:04:00+07:00', isUrgent: false, attachmentIds: [], meetingId: 'meeting-handoff' },
  { id: 'msg-4', channelId: 'same-day-schedule', authorId: 'user-manager', body: 'Chúng ta có thể chốt khung 13:30 cho bác sĩ Nguyễn không? Cần xác nhận phòng và người hỗ trợ.', createdAt: '2026-07-06T09:22:00+07:00', isUrgent: false, attachmentIds: [] },
  { id: 'msg-5', channelId: 'same-day-schedule', authorId: 'user-float', body: 'Khung giờ còn trống đến 15:45. Tôi đang kiểm tra lại phòng.', createdAt: '2026-07-06T09:30:00+07:00', isUrgent: false, attachmentIds: [] },
  { id: 'msg-6', channelId: 'same-day-schedule', authorId: 'user-lead', body: 'Lễ tân có thể nhận khung sớm hơn sau khi thay đổi lịch được xác nhận.', createdAt: '2026-07-06T09:32:00+07:00', isUrgent: false, attachmentIds: [] },
  { id: 'msg-7', channelId: 'same-day-schedule', authorId: 'user-employee', body: 'Đã cập nhật lịch. Tôi đã liên kết quy trình hiện hành cho bước bàn giao.', createdAt: '2026-07-06T09:34:00+07:00', isUrgent: false, attachmentIds: ['attachment-sop'], taskId: 'task-schedule' },
  { id: 'msg-8', channelId: 'exec-briefing', authorId: 'user-owner', body: 'Đang rà soát phân công nhân sự và các đầu việc cần bàn giao trong cuộc họp sáng.', createdAt: '2026-07-06T08:15:00+07:00', isUrgent: false, attachmentIds: [] },
  { id: 'msg-9', channelId: 'incident-triage-a', authorId: 'user-manager', body: 'Hai điều dưỡng báo nghỉ. Đã yêu cầu nhân sự luân phiên và thông báo cho lễ tân.', createdAt: '2026-07-06T08:42:00+07:00', isUrgent: true, attachmentIds: [] },
]

export const tasks: Task[] = [
  { id: 'task-schedule', title: 'Xác nhận thay đổi lịch bác sĩ Nguyễn', channelId: 'same-day-schedule', ownerId: 'user-manager', collaboratorIds: ['user-float'], dueAt: '2026-07-06T14:00:00+07:00', status: 'open', sourceMessageId: 'msg-7', checklist: [
    { id: 'check-1', label: 'Cập nhật lịch', completed: true },
    { id: 'check-2', label: 'Gọi quản lý chuyên môn', completed: false },
    { id: 'check-3', label: 'Thông báo trưởng nhóm lễ tân', completed: false },
  ], attachmentIds: ['attachment-sop'] },
  { id: 'task-terminal', title: 'Kiểm tra máy check-in B', channelId: 'front-desk-home', ownerId: 'user-employee', collaboratorIds: ['user-lead'], dueAt: '2026-07-06T11:30:00+07:00', status: 'inProgress', sourceMessageId: 'msg-2', checklist: [
    { id: 'check-terminal-1', label: 'Chuyển luồng sang máy A', completed: true },
    { id: 'check-terminal-2', label: 'Khởi động lại máy B', completed: false },
  ], attachmentIds: ['attachment-guide'] },
]

export const meetings: Meeting[] = [
  { id: 'meeting-handoff', channelId: 'front-desk-home', messageId: 'msg-meeting', organizerId: 'user-lead', title: 'Họp bàn giao lễ tân', provider: 'googleMeet', joinUrl: 'https://meet.google.com/yksg-demo-room', startsAt: '2026-07-07T10:00:00+07:00', endsAt: '2026-07-07T10:30:00+07:00', timezone: 'Asia/Ho_Chi_Minh', attendeeIds: ['user-owner', 'user-manager', 'user-lead', 'user-employee', 'user-float'], createdAt: '2026-07-06T09:04:00+07:00' },
]

export const meetingResponses: MeetingResponse[] = [
  { id: 'response-handoff-organizer', meetingId: 'meeting-handoff', userId: 'user-lead', status: 'accepted', respondedAt: '2026-07-06T09:04:00+07:00' },
]

export const announcements: Announcement[] = [
  { id: 'announcement-1', title: 'Lịch bảo trì hệ thống', body: 'Hệ thống xếp lịch sẽ tạm ngưng Chủ nhật từ 02:00 đến 04:00.', authorId: 'user-owner', audience: { organizationWide: true, locationIds: [], departmentIds: [] }, priority: 'standard', requireAcknowledgement: false, status: 'published', publishedAt: '2026-07-06T07:00:00+07:00', attachmentIds: [] },
  { id: 'announcement-2', title: 'Cập nhật hướng dẫn khách đến Cơ sở phía Đông', body: 'Xem hướng dẫn mới trước ca làm việc tiếp theo tại Cơ sở phía Đông.', authorId: 'user-manager', audience: { organizationWide: false, locationIds: ['loc-b'], departmentIds: [] }, priority: 'standard', requireAcknowledgement: true, status: 'published', publishedAt: '2026-07-05T12:00:00+07:00', attachmentIds: [] },
]

export const staffingSnapshots: StaffingSnapshot[] = [
  { locationId: 'loc-a', capturedAt: '2026-07-06T08:30:00+07:00', scheduled: 12, required: 15, departmentCoverage: [
    { departmentId: 'providers', scheduled: 3, required: 3 },
    { departmentId: 'nursing', scheduled: 4, required: 5 },
    { departmentId: 'front-desk', scheduled: 3, required: 4 },
  ] },
  { locationId: 'loc-b', capturedAt: '2026-07-06T08:30:00+07:00', scheduled: 8, required: 8, departmentCoverage: [
    { departmentId: 'providers', scheduled: 2, required: 2 },
    { departmentId: 'nursing', scheduled: 4, required: 4 },
    { departmentId: 'front-desk', scheduled: 2, required: 2 },
  ] },
]

export const accessRequests: AccessRequest[] = [
  { id: 'request-1', channelId: 'incident-triage-a', requesterId: 'user-lead', reason: 'Phối hợp lễ tân trong thời gian thiếu nhân sự.', status: 'pending', requestedAt: '2026-07-06T08:50:00+07:00', expiresAt: '2026-07-07T17:00:00+07:00' },
]

export const memberships: ChannelMembership[] = channels.flatMap((channel) =>
  channel.memberIds.map((userId, index) => ({
    id: `${channel.id}-member-${index}`,
    channelId: channel.id,
    userId,
    source: channel.type === 'department' ? 'policy' : 'invitation',
    joinedAt: '2026-01-01T09:00:00+07:00',
  })),
)

export const auditEvents: AuditEvent[] = [
  { id: 'audit-1', actorId: 'user-manager', action: 'announcement.published', targetType: 'announcement', targetLabel: 'Cập nhật hướng dẫn khách đến Cơ sở phía Đông', locationId: 'loc-b', createdAt: '2026-07-05T12:00:00+07:00', metadata: { priority: 'standard', recipients: 18 } },
  { id: 'audit-2', actorId: 'user-owner', action: 'role.assigned', targetType: 'user', targetLabel: 'Trần Thu Hà', locationId: 'loc-a', createdAt: '2026-07-04T10:30:00+07:00', metadata: { role: 'locationManager' } },
  { id: 'audit-3', actorId: 'user-employee', action: 'policy.warning.confirmed', targetType: 'message', targetLabel: 'Cảnh báo tin nhắn', locationId: 'loc-a', createdAt: '2026-07-03T15:12:00+07:00', metadata: { ruleId: 'possible-patient-identifier', contentStored: false } },
]
