/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_REQUIRE_AUTH?: string
  readonly VITE_ENABLE_MFA_BYPASS?: string
  readonly VITE_ENABLE_ATTACHMENTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
