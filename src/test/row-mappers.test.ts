import { describe, expect, it } from 'vitest'
import { formatBytes, initials, toAttachment } from '../services/rowMappers'

describe('row mappers', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('2 KB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB')
  })

  it('uses the last two name parts for initials', () => {
    expect(initials('Nguyễn Văn An')).toBe('VA')
    expect(initials('  staff  ')).toBe('S')
    expect(initials('')).toBe('')
  })

  it('maps an attachment row to an Attachment', () => {
    expect(toAttachment({
      id: 'attachment-1',
      channel_id: 'channel-1',
      uploader_member_id: 'member-1',
      original_name: 'roster.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2048,
      status: 'available',
      scan_status: 'clean',
      created_at: '2026-10-13T00:00:00.000Z',
    })).toEqual({
      id: 'attachment-1',
      name: 'roster.pdf',
      type: 'application/pdf',
      sizeLabel: '2 KB',
      sizeBytes: 2048,
      uploadedBy: 'member-1',
      uploadedAt: '2026-10-13T00:00:00.000Z',
      channelId: 'channel-1',
      status: 'available',
      scanStatus: 'clean',
    })
  })
})
