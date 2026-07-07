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

function trimUrl(value: string) {
  let next = value.trim()
  let changed = true
  while (changed) {
    const previous = next
    while (/[.,;:!?]$/.test(next)) next = next.slice(0, -1)
    while (next.endsWith(')') && !next.includes('(')) next = next.slice(0, -1)
    while (next.endsWith(']') && !next.includes('[')) next = next.slice(0, -1)
    changed = previous !== next
  }
  return next
}

function supportedMeetingUrl(value: string) {
  const urls = value.match(/https?:\/\/[^\s<>"']+/gi) ?? []
  for (const rawUrl of urls) {
    const candidate = trimUrl(rawUrl)
    try {
      const url = new URL(candidate)
      const host = url.hostname.toLowerCase()
      if (host === 'meet.google.com' && /^\/[a-z0-9-]+$/i.test(url.pathname)) {
        return { provider: 'googleMeet' as const, joinUrl: candidate }
      }
      if (host === 'zoom.us' || host.endsWith('.zoom.us')) {
        const firstSegment = url.pathname.split('/').filter(Boolean)[0]
        if (['j', 'my', 'wc'].includes(firstSegment ?? '')) {
          return { provider: 'zoom' as const, joinUrl: candidate }
        }
      }
    } catch {
      // Ignore malformed URLs and keep scanning the message.
    }
  }
  return null
}

function titleFromMeetingText(value: string, joinUrl: string) {
  const beforeLink = value.slice(0, value.indexOf(joinUrl)).trim()
  if (!beforeLink) return undefined
  const withoutDates = beforeLink
    .replace(/\b(?:at|lúc)\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)?\b/gi, '')
    .replace(/\b(?:on|ngày)?\s*\d{1,2}\/\d{1,2}\/\d{4}\b/gi, '')
    .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/gi, '')
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,)?\s+\d{4}\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:-]\s*$/g, '')
    .trim()
  return withoutDates.length >= 3 ? withoutDates : beforeLink
}

function toHoChiMinhIso(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+07:00`
}

export function detectMeetingCandidate(
  value: string,
  timezone = 'Asia/Ho_Chi_Minh',
): MeetingCandidate | null {
  const match = supportedMeetingUrl(value)
  if (!match) return null
  const { provider, joinUrl } = match
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
      endsAt = toHoChiMinhIso(new Date(start.valueOf() + 30 * 60_000))
    }
  }

  return { provider, joinUrl, title: titleFromMeetingText(value, joinUrl), startsAt, endsAt, timezone }
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
