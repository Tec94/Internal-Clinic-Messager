import { provisionAccounts } from './provision-accounts.mjs'

const now = Date.now()
const expiresSoon = new Date(now + 30 * 86_400_000).toISOString()
const expired = new Date(now - 86_400_000).toISOString()

const shared = {
  locale: 'vi-VN',
  notificationsEnabled: true,
  quietHoursStart: '21:00',
  quietHoursEnd: '07:00',
  defaultLocation: 'district-1',
  assignments: [
    { location: 'district-1', department: 'operations', primary: true },
  ],
  channelAccess: { operations: 'send' },
}

const manifest = {
  environment: 'development',
  testAccounts: true,
  organization: {
    name: 'YKSG Development Clinic',
    slug: 'yksg-development',
    defaultLocale: 'vi-VN',
    timezone: 'Asia/Ho_Chi_Minh',
  },
  locations: [
    {
      key: 'district-1',
      name: 'District 1 Development Clinic',
      shortName: 'D1 DEV',
      timezone: 'Asia/Ho_Chi_Minh',
    },
    {
      key: 'district-7',
      name: 'District 7 Development Clinic',
      shortName: 'D7 DEV',
      timezone: 'Asia/Ho_Chi_Minh',
    },
  ],
  departments: [
    { key: 'operations', name: 'Operations' },
    { key: 'front-desk', name: 'Front Desk' },
  ],
  channels: [
    {
      key: 'operations',
      name: 'development-operations',
      displayName: 'Development Operations',
      purpose: 'Synthetic operational coordination for access testing.',
      type: 'department',
      visibility: 'private',
      owner: 'owner_aal2',
      locations: ['district-1', 'district-7'],
      departments: ['operations'],
    },
  ],
  accounts: [
    {
      ...shared,
      key: 'owner_aal2',
      email: 'test.owner.aal2@yksg.example',
      fullName: 'Test Owner AAL2',
      role: 'owner',
      aal: 'aal2',
      roleLocations: ['district-1', 'district-7'],
      roleDepartments: ['operations', 'front-desk'],
    },
    {
      ...shared,
      key: 'admin_aal2',
      email: 'test.admin.aal2@yksg.example',
      fullName: 'Test Admin AAL2',
      role: 'org_admin',
      aal: 'aal2',
    },
    {
      ...shared,
      key: 'location_manager',
      email: 'test.location.manager@yksg.example',
      fullName: 'Test Location Manager',
      role: 'location_manager',
      aal: 'aal2',
      roleLocations: ['district-1'],
    },
    {
      ...shared,
      key: 'department_lead',
      email: 'test.department.lead@yksg.example',
      fullName: 'Test Department Lead',
      role: 'department_lead',
      aal: 'aal2',
      roleDepartments: ['operations'],
    },
    {
      ...shared,
      key: 'staff_sender',
      email: 'test.staff.sender@yksg.example',
      fullName: 'Test Staff Sender',
      role: 'staff',
      aal: 'aal2',
    },
    {
      ...shared,
      key: 'staff_view_only',
      email: 'test.staff.viewer@yksg.example',
      fullName: 'Test Staff Viewer',
      role: 'staff',
      aal: 'aal2',
      channelAccess: { operations: 'view' },
    },
    {
      ...shared,
      key: 'multi_location_staff',
      email: 'test.staff.multilocation@yksg.example',
      fullName: 'Test Multi-location Staff',
      role: 'staff',
      aal: 'aal2',
      assignments: [
        { location: 'district-1', department: 'operations', primary: true },
        { location: 'district-7', department: 'front-desk', primary: false },
      ],
    },
    {
      ...shared,
      key: 'contractor_expiring',
      email: 'test.contractor@yksg.example',
      fullName: 'Test Expiring Contractor',
      role: 'contractor',
      employmentType: 'contractor',
      expiresAt: expiresSoon,
      roleExpiresAt: expiresSoon,
      channelAccessExpiresAt: expiresSoon,
      aal: 'aal2',
    },
    {
      ...shared,
      key: 'it_support',
      email: 'test.it.support@yksg.example',
      fullName: 'Test IT Support',
      role: 'it_support',
      aal: 'aal2',
    },
    {
      ...shared,
      key: 'aal1_denied',
      email: 'test.aal1@yksg.example',
      fullName: 'Test AAL1 Staff',
      role: 'staff',
      aal: 'aal1',
    },
    {
      ...shared,
      key: 'development_bypass',
      email: 'test.bypass@yksg.example',
      fullName: 'Test Development Bypass',
      role: 'staff',
      aal: 'bypass',
    },
    {
      ...shared,
      key: 'suspended',
      email: 'test.suspended@yksg.example',
      fullName: 'Test Suspended Staff',
      role: 'staff',
      status: 'suspended',
      aal: 'aal2',
    },
    {
      ...shared,
      key: 'expired',
      email: 'test.expired@yksg.example',
      fullName: 'Test Expired Staff',
      role: 'staff',
      startsAt: new Date(now - 60 * 86_400_000).toISOString(),
      expiresAt: expired,
      aal: 'aal2',
    },
    {
      key: 'outsider',
      email: 'test.outsider@yksg.example',
      fullName: 'Test Outsider',
      outsider: true,
      aal: 'aal2',
    },
  ],
}

const result = await provisionAccounts(manifest, {
  outputPath: '.test-accounts.local.json',
})
console.log(
  `Provisioned ${result.accountCount} development test accounts for `
  + `${result.organizationId}.`,
)
console.log(`Credentials were saved to ${result.outputPath}.`)
