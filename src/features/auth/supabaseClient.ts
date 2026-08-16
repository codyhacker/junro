import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Whether the auth/sync feature has env config to run at all. Unlike the
// Mapbox token (which degrades to a failed fetch when empty), createClient()
// throws synchronously on an empty url/key — so every caller checks this (or
// treats a null getSupabaseClient() as "disabled") rather than letting that
// throw reach them.
export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

// Lazy singleton — instantiating at module load would touch `window`/
// `localStorage` in non-browser contexts (Vitest under Node), same reasoning
// as getTripStorage() in features/trip/storage.ts.
let instance: SupabaseClient | null = null
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!instance) {
    instance = createClient(
      import.meta.env.VITE_SUPABASE_URL!,
      import.meta.env.VITE_SUPABASE_ANON_KEY!,
      {
        auth: { flowType: 'pkce' },
      },
    )
  }
  return instance
}
