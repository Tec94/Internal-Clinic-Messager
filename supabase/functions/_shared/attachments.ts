import { createClient } from 'npm:@supabase/supabase-js@2.110.7'

export const QUARANTINE_BUCKET = 'operational-attachments-quarantine'
export const AVAILABLE_BUCKET = 'operational-attachments'

export interface AttachmentRow {
  id: string
  organization_id: string
  channel_id: string
  uploader_member_id: string
  original_name: string
  mime_type: string
  size_bytes: number
  object_path: string
  status: 'uploading' | 'available' | 'rejected' | 'failed'
  scan_status: 'pending' | 'bypassed_dev' | 'clean' | 'rejected' | 'failed'
  created_at: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function handleOptions(request: Request) {
  return request.method === 'OPTIONS'
    ? new Response('ok', { headers: corsHeaders })
    : null
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}

export function createRequestClients(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new RequestError(401, 'An authenticated session is required.')
  }

  const url = Deno.env.get('SUPABASE_URL')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !publicKey || !serviceRoleKey) {
    throw new RequestError(500, 'Attachment storage is not configured.')
  }

  return {
    user: createClient(url, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    }),
    admin: createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    }),
  }
}

export async function readAttachmentId(request: Request) {
  if (request.method !== 'POST') {
    throw new RequestError(405, 'Only POST requests are supported.')
  }
  let body: { attachmentId?: unknown }
  try {
    body = await request.json()
  } catch {
    throw new RequestError(400, 'The request body must be valid JSON.')
  }

  if (
    typeof body.attachmentId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(body.attachmentId)
  ) {
    throw new RequestError(400, 'A valid attachmentId is required.')
  }
  return body.attachmentId
}

export class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof RequestError) {
    return jsonResponse({ error: error.message }, error.status)
  }
  return jsonResponse({ error: 'The attachment request failed.' }, 500)
}
