/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string
  readonly VITE_PMTILES_URL?: string
  // Public URL of the filtered Overture places .pmtiles (discovery layer).
  // Defaults to the R2 bucket in shared/constants/discovery.ts when unset.
  readonly VITE_PLACES_PMTILES_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
