import {
  announcements,
  attachments,
  auditEvents,
  meetings,
  staffingSnapshots,
  tasks,
} from '../data/seed'
import type {
  Announcement,
  Attachment,
  AuditEvent,
  Meeting,
  MeetingCandidate,
  PolicyWarning,
  StaffingSnapshot,
  Task,
} from '../types/domain'

const wait = (duration = 120) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration))

export const clinicService = {
  async getStaffing(): Promise<StaffingSnapshot[]> {
    await wait()
    return staffingSnapshots
  },
  async getAnnouncements(): Promise<Announcement[]> {
    await wait()
    return announcements
  },
  async getAuditEvents(): Promise<AuditEvent[]> {
    await wait()
    return auditEvents
  },
  async getTasks(): Promise<Task[]> {
    await wait()
    return tasks
  },
  async getAttachments(): Promise<Attachment[]> {
    await wait()
    return attachments
  },
  async getMeetings(): Promise<Meeting[]> {
    await wait()
    return meetings
  },
}

const monthIndexes: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

export function detectMeetingCandidate(
  value: string,
  timezone = 'Asia/Ho_Chi_Minh',
): MeetingCandidate | null {
  const zoomUrl = value.match(/https?:\/\/(?:[\w-]+\.)?zoom\.us\/(?:j|my|wc)\/[\w?=&.-]+/i)?.[0]
  const meetUrl = value.match(/https?:\/\/meet\.google\.com\/[\w-]+/i)?.[0]
  const joinUrl = meetUrl ?? zoomUrl
  if (!joinUrl) return null

  const provider = meetUrl ? 'googleMeet' : 'zoom'
  const viDate = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  const isoDate = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  const englishDate = value.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(\d{4})\b/)
  const clockTime = value.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)?\b/i)
  const meridiemTime = value.match(/\b(\d{1,2})\s*(AM|PM)\b/i)

  let year: number | undefined
  let month: number | undefined
  let day: number | undefined
  if (viDate) {
    day = Number(viDate[1]); month = Number(viDate[2]); year = Number(viDate[3])
  } else if (isoDate) {
    year = Number(isoDate[1]); month = Number(isoDate[2]); day = Number(isoDate[3])
  } else if (englishDate) {
    month = monthIndexes[englishDate[1].toLowerCase()]
    day = Number(englishDate[2]); year = Number(englishDate[3])
  }

  let hour = clockTime ? Number(clockTime[1]) : meridiemTime ? Number(meridiemTime[1]) : undefined
  const minute = clockTime ? Number(clockTime[2]) : meridiemTime ? 0 : undefined
  const meridiem = clockTime?.[3] ?? meridiemTime?.[2]
  if (hour !== undefined && meridiem) {
    if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12
    if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0
  }

  let startsAt: string | undefined
  let endsAt: string | undefined
  if (year && month && day && hour !== undefined && minute !== undefined) {
    const local = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`
    const start = new Date(local)
    if (!Number.isNaN(start.valueOf())) {
      startsAt = local
      endsAt = new Date(start.valueOf() + 30 * 60_000).toISOString()
    }
  }

  return { provider, joinUrl, startsAt, endsAt, timezone }
}

const warningPatterns = [
  { ruleId: 'possible-mrn', expression: /\b(?:mrn|medical record)\s*[:#-]?\s*\d{4,}\b/i },
  { ruleId: 'possible-date-of-birth', expression: /\b(?:dob|date of birth)\s*[:#-]?/i },
  { ruleId: 'patient-language', expression: /\bpatient\s+(?:named|name|case|record)\b/i },
]

export function inspectOperationalContent(
  value: string,
  field: PolicyWarning['field'] = 'message',
): PolicyWarning[] {
  return warningPatterns.flatMap((pattern, index) => {
    const match = value.match(pattern.expression)
    if (!match) return []
    return [
      {
        id: `warning-${Date.now()}-${index}`,
        field,
        ruleId: pattern.ruleId,
        messageKey: 'policy.possiblePhi',
        matchedText: match[0],
        createdAt: new Date().toISOString(),
      },
    ]
  })
}
