/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_REQUIRE_AUTH?: string
  readonly VITE_ENABLE_MFA_BYPASS?: string
  readonly VITE_ENABLE_ATTACHMENTS?: string
  readonly VITE_ENABLE_ZALO_LAUNCHER?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
