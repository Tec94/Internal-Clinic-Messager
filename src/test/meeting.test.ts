import { describe, expect, it } from 'vitest'
import { detectMeetingCandidate } from '../services/mockClinicService'

describe('meeting candidate detection', () => {
  it('parses a Vietnamese date and Google Meet link', () => {
    const candidate = detectMeetingCandidate('Họp lúc 10:00 ngày 07/07/2026 https://meet.google.com/abc-defg-hij')
    expect(candidate).toMatchObject({ provider: 'googleMeet', startsAt: '2026-07-07T10:00:00+07:00', timezone: 'Asia/Ho_Chi_Minh' })
  })

  it('parses an English date and Zoom link', () => {
    const candidate = detectMeetingCandidate('Team sync July 8, 2026 at 2:30 PM https://yksg.zoom.us/j/123456789')
    expect(candidate).toMatchObject({ provider: 'zoom', startsAt: '2026-07-08T14:30:00+07:00' })
  })

  it('leaves ambiguous times blank and ignores unrelated links', () => {
    expect(detectMeetingCandidate('Join when ready https://meet.google.com/abc-defg-hij')?.startsAt).toBeUndefined()
    expect(detectMeetingCandidate('Read https://example.com/meeting')).toBeNull()
  })
})
