import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  AVAILABLE_BUCKET,
  type AttachmentRow,
  createRequestClients,
  errorResponse,
  handleOptions,
  jsonResponse,
  QUARANTINE_BUCKET,
  readAttachmentId,
  RequestError,
} from '../_shared/attachments.ts'

Deno.serve(async (request: Request) => {
  const optionsResponse = handleOptions(request)
  if (optionsResponse) return optionsResponse

  let attachmentId: string | undefined
  try {
    attachmentId = await readAttachmentId(request)
    const scanMode = Deno.env.get('ATTACHMENT_SCAN_MODE')
    if (scanMode !== 'dev_bypass' && scanMode !== 'clamav') {
      throw new RequestError(
        503,
        'Attachment promotion is disabled until a scanner is configured.',
      )
    }

    const { user, admin } = createRequestClients(request)
    const { data: attachment, error: authorizationError } = await user
      .rpc('authorize_attachment_finalize', {
        target_attachment_id: attachmentId,
      })
      .single()

    if (authorizationError || !attachment) {
      throw new RequestError(
        403,
        'This attachment cannot be finalized by the current member.',
      )
    }
    const authorizedAttachment = attachment as AttachmentRow
    const { folder, fileName } = splitObjectPath(
      authorizedAttachment.object_path,
    )
    const { data: objects, error: listError } = await admin.storage
      .from(QUARANTINE_BUCKET)
      .list(folder, { limit: 10, search: fileName })
    if (listError) {
      throw new RequestError(502, 'The uploaded object could not be verified.')
    }

    const storedObject = objects.find((object) => object.name === fileName)
    const metadata = storedObject?.metadata as
      | {
          size?: number
          contentLength?: number
          mimetype?: string
          contentType?: string
        }
      | undefined
    const storedSize = Number(metadata?.size ?? metadata?.contentLength ?? 0)
    const storedMimeType = metadata?.mimetype ?? metadata?.contentType
    if (
      !storedObject
      || storedSize !== authorizedAttachment.size_bytes
      || storedMimeType !== authorizedAttachment.mime_type
    ) {
      if (storedObject) {
        await admin.storage
          .from(QUARANTINE_BUCKET)
          .remove([authorizedAttachment.object_path])
      }
      const { error: rejectionError } = await admin
        .rpc('reject_attachment_upload', {
          target_attachment_id: authorizedAttachment.id,
          target_reason: 'stored_object_metadata_mismatch',
        })
      if (rejectionError) {
        throw new RequestError(500, 'The rejected upload could not be recorded.')
      }
      throw new RequestError(
        422,
        'The stored object does not match the authorized upload.',
      )
    }

    let scanResult: { scanner: string; signature: string } | null = null
    if (scanMode === 'clamav') {
      scanResult = await scanAttachment(
        admin,
        authorizedAttachment,
      )
      if (!scanResult) {
        await admin.storage
          .from(QUARANTINE_BUCKET)
          .remove([authorizedAttachment.object_path])
        await admin.rpc('reject_attachment_upload', {
          target_attachment_id: authorizedAttachment.id,
          target_reason: 'malware_scan_rejected',
        })
        throw new RequestError(422, 'The attachment failed the safety scan.')
      }
    }

    const { error: moveError } = await admin.storage
      .from(QUARANTINE_BUCKET)
      .move(
        authorizedAttachment.object_path,
        authorizedAttachment.object_path,
        { destinationBucket: AVAILABLE_BUCKET },
      )
    if (moveError) {
      throw new RequestError(502, 'The attachment could not be promoted.')
    }

    const completion = scanMode === 'dev_bypass'
      ? admin.rpc('complete_attachment_dev_bypass', {
          target_attachment_id: authorizedAttachment.id,
        })
      : admin.rpc('complete_attachment_clean', {
          target_attachment_id: authorizedAttachment.id,
          target_scanner: scanResult?.scanner ?? 'clamav',
          target_signature: scanResult?.signature ?? 'unknown',
        })
    const { data: completed, error: completionError } =
      await completion.single()
    if (completionError || !completed) {
      const { error: rollbackError } = await admin.storage
        .from(AVAILABLE_BUCKET)
        .move(
          authorizedAttachment.object_path,
          authorizedAttachment.object_path,
          { destinationBucket: QUARANTINE_BUCKET },
        )
      if (rollbackError) {
        console.error(
          `Attachment ${authorizedAttachment.id} promotion rollback failed.`,
        )
      }
      throw new RequestError(
        500,
        'The attachment promotion could not be recorded.',
      )
    }

    return jsonResponse({ attachment: completed })
  } catch (error) {
    if (!(error instanceof RequestError)) {
      console.error(
        `Attachment ${attachmentId ?? 'unknown'} finalization failed.`,
      )
    }
    return errorResponse(error)
  }
})

function splitObjectPath(objectPath: string) {
  const segments = objectPath.split('/')
  const fileName = segments.pop()
  if (!fileName || segments.length !== 3) {
    throw new RequestError(422, 'The attachment object path is invalid.')
  }
  return { folder: segments.join('/'), fileName }
}

async function scanAttachment(
  admin: ReturnType<typeof createRequestClients>['admin'],
  attachment: AttachmentRow,
) {
  const endpoint = Deno.env.get('ATTACHMENT_SCANNER_URL')?.trim()
  const secret = Deno.env.get('ATTACHMENT_SCANNER_SECRET')?.trim()
  if (!endpoint || !secret || !endpoint.startsWith('https://')) {
    throw new RequestError(503, 'The attachment scanner is not configured.')
  }
  const { data, error } = await admin.storage
    .from(QUARANTINE_BUCKET)
    .createSignedUrl(attachment.object_path, 60)
  if (error || !data?.signedUrl) {
    throw new RequestError(502, 'The attachment scan could not be prepared.')
  }
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attachmentId: attachment.id,
        url: data.signedUrl,
        sizeBytes: attachment.size_bytes,
        mimeType: attachment.mime_type,
      }),
      signal: AbortSignal.timeout(45_000),
    })
  } catch {
    throw new RequestError(502, 'The attachment scanner is unavailable.')
  }
  if (!response.ok) {
    throw new RequestError(502, 'The attachment scanner rejected the request.')
  }
  const result = await response.json() as {
    clean?: unknown
    scanner?: unknown
    signature?: unknown
  }
  if (result.clean !== true) return null
  return {
    scanner: typeof result.scanner === 'string' ? result.scanner : 'clamav',
    signature:
      typeof result.signature === 'string' ? result.signature : 'clean',
  }
}
