import type { Attachment } from '../types/domain'

export interface AttachmentRow {
  id: string
  channel_id: string
  uploader_member_id: string
  original_name: string
  mime_type: string
  size_bytes: number
  status: Attachment['status']
  scan_status: Attachment['scanStatus']
  created_at: string
}

export function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    name: row.original_name,
    type: row.mime_type,
    sizeLabel: formatBytes(row.size_bytes),
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploader_member_id,
    uploadedAt: row.created_at,
    channelId: row.channel_id,
    status: row.status,
    scanStatus: row.scan_status,
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(
    bytes >= 10 * 1024 * 1024 ? 0 : 1,
  )} MB`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase())
    .join('')
}
