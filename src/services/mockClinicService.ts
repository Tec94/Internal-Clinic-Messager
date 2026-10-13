import {
  auditEvents,
  staffingSnapshots,
} from '../data/seed'
import type {
  AuditEvent,
  StaffingSnapshot,
} from '../types/domain'

const wait = (duration = 120) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration))

export const clinicService = {
  async getStaffing(): Promise<StaffingSnapshot[]> {
    await wait()
    return staffingSnapshots
  },
  async getAuditEvents(): Promise<AuditEvent[]> {
    await wait()
    return auditEvents
  },
}
