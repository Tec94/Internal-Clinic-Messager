import { describe, expect, it, vi } from 'vitest'
import type { Attachment } from '../types/domain'
import {
  createSupabaseAttachmentRepository,
} from '../services/attachmentRepository'
import { supabase } from '../utils/supabase'

const tusState = vi.hoisted(() => ({
  options: undefined as {
    chunkSize?: number
    headers?: Record<string, string>
    metadata?: Record<string, string>
    onProgress?: (uploaded: number, total: number) => void
    onSuccess?: () => void
  } | undefined,
}))

vi.mock('tus-js-client', () => ({
  Upload: class UploadMock {
    private readonly file: File
    private readonly options: NonNullable<typeof tusState.options>

    constructor(
      file: File,
      options: NonNullable<typeof tusState.options>,
    ) {
      this.file = file
      this.options = options
      tusState.options = options
    }

    async findPreviousUploads() {
      return []
    }

    resumeFromPreviousUpload() {}

    start() {
      this.options.onProgress?.(this.file.size, this.file.size)
      this.options.onSuccess?.()
    }

    async abort() {}
  },
}))

describe('Supabase attachment repository', () => {
  it('initializes an opaque upload and maps its metadata', async () => {
    const single = vi.fn().mockResolvedValue({
      data: attachmentRow(),
      error: null,
    })
    const rpc = vi.fn(() => ({ single }))
    const repository = createSupabaseAttachmentRepository({
      rpc,
    } as unknown as typeof supabase)
    const file = new File(['handoff'], 'handoff.pdf', {
      type: 'application/pdf',
    })

    await expect(repository.initializeUpload(
      file,
      '50000000-0000-0000-0000-000000000021',
      '70000000-0000-0000-0000-000000000021',
    )).resolves.toEqual(expect.objectContaining({
      id: '71000000-0000-0000-0000-000000000021',
      objectPath: expect.stringContaining('/original.pdf'),
      scanStatus: 'pending',
    }))
    expect(rpc).toHaveBeenCalledWith('create_attachment_upload', {
      target_channel_id: '50000000-0000-0000-0000-000000000021',
      target_original_name: 'handoff.pdf',
      target_mime_type: 'application/pdf',
      target_size_bytes: file.size,
      target_client_attachment_id:
        '70000000-0000-0000-0000-000000000021',
    })
  })

  it('uses six MiB TUS chunks, progress events, and no upserts', async () => {
    const onProgress = vi.fn()
    const repository = createSupabaseAttachmentRepository({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'user-token' } },
          error: null,
        }),
      },
    } as unknown as typeof supabase)
    const file = new File(
      [new Uint8Array(7 * 1024 * 1024)],
      'large.pdf',
      { type: 'application/pdf' },
    )

    await repository.uploadResumable(file, attachment(), { onProgress })

    expect(tusState.options?.chunkSize).toBe(6 * 1024 * 1024)
    expect(tusState.options?.headers?.['x-upsert']).toBe('false')
    expect(tusState.options?.metadata).toEqual(expect.objectContaining({
      bucketName: 'operational-attachments-quarantine',
      objectName: expect.stringContaining('/original.pdf'),
      cacheControl: '0',
    }))
    expect(onProgress).toHaveBeenCalledWith({
      bytesUploaded: file.size,
      bytesTotal: file.size,
      percentage: 100,
    })
  })

  it('uses the protected Edge Functions for finalization and downloads', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({
        data: {
          attachment: {
            ...attachmentRow(),
            status: 'available',
            scan_status: 'bypassed_dev',
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { url: 'https://example.test/signed', expiresIn: 60 },
        error: null,
      })
    const repository = createSupabaseAttachmentRepository({
      functions: { invoke },
    } as unknown as typeof supabase)

    await expect(repository.finalizeUpload(
      '71000000-0000-0000-0000-000000000021',
    )).resolves.toEqual(expect.objectContaining({
      status: 'available',
      scanStatus: 'bypassed_dev',
    }))
    await expect(repository.getDownloadUrl(
      '71000000-0000-0000-0000-000000000021',
    )).resolves.toBe('https://example.test/signed')
    expect(invoke).toHaveBeenNthCalledWith(
      1,
      'finalize-attachment-upload',
      {
        body: {
          attachmentId: '71000000-0000-0000-0000-000000000021',
        },
      },
    )
    expect(invoke).toHaveBeenNthCalledWith(
      2,
      'create-attachment-download',
      {
        body: {
          attachmentId: '71000000-0000-0000-0000-000000000021',
        },
      },
    )
  })
})

function attachmentRow() {
  return {
    id: '71000000-0000-0000-0000-000000000021',
    organization_id: '00000000-0000-0000-0000-000000000021',
    channel_id: '50000000-0000-0000-0000-000000000021',
    uploader_member_id: '20000000-0000-0000-0000-000000000021',
    original_name: 'handoff.pdf',
    mime_type: 'application/pdf',
    size_bytes: 7,
    object_path:
      '00000000-0000-0000-0000-000000000021/' +
      '50000000-0000-0000-0000-000000000021/' +
      '71000000-0000-0000-0000-000000000021/original.pdf',
    status: 'uploading' as const,
    scan_status: 'pending' as const,
    created_at: '2026-07-26T08:58:16.000Z',
  }
}

function attachment(): Attachment & { objectPath: string } {
  const row = attachmentRow()
  return {
    id: row.id,
    name: row.original_name,
    type: row.mime_type,
    sizeLabel: '7 MB',
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploader_member_id,
    uploadedAt: row.created_at,
    channelId: row.channel_id,
    status: row.status,
    scanStatus: row.scan_status,
    objectPath: row.object_path,
  }
}
