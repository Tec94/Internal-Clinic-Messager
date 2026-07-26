import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import {
  AVAILABLE_BUCKET,
  type AttachmentRow,
  createRequestClients,
  errorResponse,
  handleOptions,
  jsonResponse,
  readAttachmentId,
  RequestError,
} from '../_shared/attachments.ts'

Deno.serve(async (request: Request) => {
  const optionsResponse = handleOptions(request)
  if (optionsResponse) return optionsResponse

  try {
    const attachmentId = await readAttachmentId(request)
    const { user, admin } = createRequestClients(request)
    const { data: attachment, error: authorizationError } = await user
      .rpc('authorize_attachment_download', {
        target_attachment_id: attachmentId,
      })
      .single()

    if (authorizationError || !attachment) {
      throw new RequestError(
        403,
        'This attachment is not available to the current member.',
      )
    }
    const authorizedAttachment = attachment as AttachmentRow
    if (
      authorizedAttachment.scan_status === 'bypassed_dev'
      && Deno.env.get('ATTACHMENT_SCAN_MODE') !== 'dev_bypass'
    ) {
      throw new RequestError(
        503,
        'Development-bypassed attachments are disabled in this environment.',
      )
    }

    const { data: signedDownload, error: signingError } = await admin.storage
      .from(AVAILABLE_BUCKET)
      .createSignedUrl(authorizedAttachment.object_path, 60, {
        download: authorizedAttachment.original_name,
      })
    if (signingError || !signedDownload?.signedUrl) {
      throw new RequestError(502, 'The download URL could not be created.')
    }

    const signedUrl = new URL(signedDownload.signedUrl)

    return jsonResponse({
      url: `${signedUrl.pathname}${signedUrl.search}`,
      expiresIn: 60,
    })
  } catch (error) {
    return errorResponse(error)
  }
})
