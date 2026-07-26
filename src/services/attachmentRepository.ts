import { Upload } from 'tus-js-client'
import type { Attachment } from '../types/domain'
import { supabase } from '../utils/supabase'
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  resolveAttachmentMimeType,
  validateUploadFiles,
} from './uploadAdapter'

const QUARANTINE_BUCKET = 'operational-attachments-quarantine'
const TUS_CHUNK_SIZE = 6 * 1024 * 1024

interface AttachmentRow {
  id: string
  organization_id: string
  channel_id: string
  uploader_member_id: string
  original_name: string
  mime_type: string
  size_bytes: number
  object_path: string
  status: Attachment['status']
  scan_status: Attachment['scanStatus']
  created_at: string
}

export interface AttachmentUploadProgress {
  bytesUploaded: number
  bytesTotal: number
  percentage: number
}

export interface AttachmentUploadOptions {
  signal?: AbortSignal
  onProgress?: (progress: AttachmentUploadProgress) => void
}

export interface AttachmentRepository {
  initializeUpload: (
    file: File,
    channelId: string,
    clientAttachmentId?: string,
  ) => Promise<Attachment & { objectPath: string }>
  uploadResumable: (
    file: File,
    attachment: Attachment & { objectPath: string },
    options?: AttachmentUploadOptions,
  ) => Promise<void>
  finalizeUpload: (attachmentId: string) => Promise<Attachment>
  getDownloadUrl: (attachmentId: string) => Promise<string>
}

export function createSupabaseAttachmentRepository(
  client: typeof supabase = supabase,
): AttachmentRepository {
  return {
    async initializeUpload(
      file,
      channelId,
      clientAttachmentId = crypto.randomUUID(),
    ) {
      const validation = validateUploadFiles([file])
      if (validation) throw new Error(validation)
      const mimeType = resolveAttachmentMimeType(file)
      const { data, error } = await client
        .rpc('create_attachment_upload', {
          target_channel_id: channelId,
          target_original_name: file.name,
          target_mime_type: mimeType,
          target_size_bytes: file.size,
          target_client_attachment_id: clientAttachmentId,
        })
        .single()

      if (error) {
        throw new Error(`Could not initialize attachment upload: ${error.message}`)
      }
      return mapAttachment(data as AttachmentRow)
    },

    async uploadResumable(file, attachment, options = {}) {
      const {
        data: { session },
        error,
      } = await client.auth.getSession()
      if (error || !session?.access_token) {
        throw new Error('An authenticated session is required to upload files.')
      }

      const endpoint = createTusEndpoint(import.meta.env.VITE_SUPABASE_URL)
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (callback: () => void) => {
          if (settled) return
          settled = true
          options.signal?.removeEventListener('abort', abortUpload)
          callback()
        }
        const upload = new Upload(file, {
          endpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'x-upsert': 'false',
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          chunkSize: TUS_CHUNK_SIZE,
          metadata: {
            bucketName: QUARANTINE_BUCKET,
            objectName: attachment.objectPath,
            contentType: attachment.type,
            cacheControl: '0',
          },
          onError: (uploadError) => {
            finish(() => reject(
              new Error(`Could not upload ${file.name}: ${uploadError.message}`),
            ))
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            options.onProgress?.({
              bytesUploaded,
              bytesTotal,
              percentage:
                bytesTotal === 0
                  ? 0
                  : Math.round((bytesUploaded / bytesTotal) * 100),
            })
          },
          onSuccess: () => finish(resolve),
        })

        const abortUpload = () => {
          void upload.abort(true).finally(() => {
            finish(() => reject(
              new DOMException('The attachment upload was cancelled.', 'AbortError'),
            ))
          })
        }

        if (options.signal?.aborted) {
          abortUpload()
          return
        }
        options.signal?.addEventListener('abort', abortUpload, { once: true })

        void upload.findPreviousUploads()
          .then((previousUploads) => {
            if (previousUploads.length > 0) {
              upload.resumeFromPreviousUpload(previousUploads[0])
            }
            upload.start()
          })
          .catch((uploadError: Error) => {
            finish(() => reject(
              new Error(`Could not resume ${file.name}: ${uploadError.message}`),
            ))
          })
      })
    },

    async finalizeUpload(attachmentId) {
      const { data, error } = await client.functions.invoke<{
        attachment: AttachmentRow
      }>('finalize-attachment-upload', {
        body: { attachmentId },
      })
      if (error || !data?.attachment) {
        throw new Error(
          `Could not finalize attachment upload: ${error?.message ?? 'No attachment was returned.'}`,
        )
      }
      return mapAttachment(data.attachment)
    },

    async getDownloadUrl(attachmentId) {
      const { data, error } = await client.functions.invoke<{
        url: string
        expiresIn: number
      }>('create-attachment-download', {
        body: { attachmentId },
      })
      if (error || !data?.url) {
        throw new Error(
          `Could not create attachment download: ${error?.message ?? 'No URL was returned.'}`,
        )
      }
      return new URL(
        data.url,
        import.meta.env.VITE_SUPABASE_URL,
      ).toString()
    },
  }
}

function createTusEndpoint(projectUrl: string) {
  const url = new URL(projectUrl)
  if (url.hostname.endsWith('.supabase.co')) {
    url.hostname = url.hostname.replace(
      /\.supabase\.co$/,
      '.storage.supabase.co',
    )
  }
  url.pathname = '/storage/v1/upload/resumable'
  url.search = ''
  url.hash = ''
  return url.toString()
}

function mapAttachment(
  row: AttachmentRow,
): Attachment & { objectPath: string } {
  if (row.size_bytes > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error('The backend returned an oversized attachment.')
  }
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
    objectPath: row.object_path,
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(
    bytes >= 10 * 1024 * 1024 ? 0 : 1,
  )} MB`
}
