/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string
  readonly VITE_PMTILES_URL?: string
  // Public URL of the filtered Overture places .pmtiles (discovery layer).
  // Defaults to the R2 bucket in shared/constants/discovery.ts when unset.
  readonly VITE_PLACES_PMTILES_URL?: string
  // Supabase project URL + anon/publishable key (features/auth). Both unset
  // means the auth/sync feature is disabled — getSupabaseClient() returns
  // null and every caller degrades gracefully, same posture as the Mapbox
  // token when it's unset.
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
