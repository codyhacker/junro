import type { AppStore } from '../../app/store'
import { getSupabaseClient } from './supabaseClient'
import { authStateChanged } from './authSlice'

// Subscribes to Supabase's own session state and mirrors the minimal
// {id, email} shape into Redux (authSlice keeps everything else — tokens —
// out of the store entirely; supabase-js manages the real session itself).
// Called once from main.tsx, alongside hydrateTrips.
//
// onAuthStateChange fires an INITIAL_SESSION event immediately on subscribe
// with whatever session it found in its own storage, so `status: 'unknown'`
// resolves quickly with no separate getSession() call — this function exists
// purely to avoid a flash of signed-out UI before that first callback lands.
export function bootAuthSession(store: AppStore): () => void {
  const client = getSupabaseClient()
  if (!client) return () => {}

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    store.dispatch(
      authStateChanged({
        user: session?.user ? { id: session.user.id, email: session.user.email ?? null } : null,
      }),
    )
  })

  return () => subscription.unsubscribe()
}
