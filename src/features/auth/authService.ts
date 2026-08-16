import { getSupabaseClient } from './supabaseClient'

// Email magic-link auth over Supabase's HTTP API. This service touches only
// HTTP: it never reads Redux. The resulting session change reaches the rest
// of the app through bootAuthSession's onAuthStateChange subscription, not
// through a return value here.

export async function requestMagicLink(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabaseClient()
  if (!client) return { ok: false, error: 'Supabase not configured' }

  // BASE_URL matters here: vite.config.js sets base: '/junro/', so
  // window.location.origin alone would send the link back to the domain
  // root instead of into the app.
  const emailRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo } })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  await client.auth.signOut()
}
