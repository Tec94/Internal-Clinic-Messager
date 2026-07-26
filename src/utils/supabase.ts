import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const previewMode = import.meta.env.VITE_REQUIRE_AUTH === 'false'

if (!previewMode && (!supabaseUrl || !supabaseKey)) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required.',
  )
}

export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseKey || 'preview-only-publishable-key',
)
