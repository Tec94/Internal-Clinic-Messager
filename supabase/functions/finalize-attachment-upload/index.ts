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
    if (Deno.env.get('ATTACHMENT_SCAN_MODE') !== 'dev_bypass') {
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

    const { data: completed, error: completionError } = await admin
      .rpc('complete_attachment_dev_bypass', {
        target_attachment_id: authorizedAttachment.id,
      })
      .single()
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
