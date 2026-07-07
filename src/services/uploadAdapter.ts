import type { Attachment, UploadAttachmentAdapter, UploadTarget } from '../types/domain'

export const ACCEPTED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]

export const ACCEPTED_ATTACHMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg']
export const MAX_ATTACHMENT_FILES = 5
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

function isAcceptedFile(file: File) {
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()?.toLowerCase()}` : ''
  return ACCEPTED_ATTACHMENT_TYPES.includes(file.type) || ACCEPTED_ATTACHMENT_EXTENSIONS.includes(extension)
}

function createSessionUrl(file: File) {
  if (typeof URL !== 'undefined' && 'createObjectURL' in URL) {
    return URL.createObjectURL(file)
  }
  return `preview://${encodeURIComponent(file.name)}`
}

export function validateUploadFiles(files: File[]) {
  if (files.length > MAX_ATTACHMENT_FILES) {
    return `Upload up to ${MAX_ATTACHMENT_FILES} files at a time.`
  }
  const rejected = files.find((file) => !isAcceptedFile(file))
  if (rejected) return `${rejected.name} is not a supported file type.`
  const oversized = files.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES)
  if (oversized) return `${oversized.name} is larger than 10 MB.`
  return null
}

export const mockUploadAdapter: UploadAttachmentAdapter = {
  async upload(files: File[], target: UploadTarget, uploadedBy: string): Promise<Attachment[]> {
    const validation = validateUploadFiles(files)
    if (validation) throw new Error(validation)
    const uploadedAt = new Date().toISOString()
    return files.map((file, index) => {
      const url = createSessionUrl(file)
      return {
        id: `attachment-${Date.now()}-${index}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        sizeLabel: formatBytes(file.size),
        sizeBytes: file.size,
        uploadedBy,
        uploadedAt,
        channelId: target.channelId,
        messageId: target.messageId ?? `draft-${Date.now()}-${index}`,
        taskId: target.kind === 'task' ? target.taskId : undefined,
        previewUrl: url,
        downloadUrl: url,
      }
    })
  },
}
