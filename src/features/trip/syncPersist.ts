// Mirrors app/persist.ts's shape under its own localStorage key: sync
// metadata isn't a UI pref (junro:prefs' own comment scopes it to those), and
// only the durable half of a SyncEntry — remoteRevision — is worth keeping
// across a reload. status/lastError/serverTrip/serverRevision are transient
// and should always reset to 'idle' on load rather than resurrect a stuck
// spinner or a stale conflict banner.

export const SYNC_STORAGE_KEY = 'junro:sync'

export function loadPersistedSync(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function savePersistedSync(
  byTripId: Record<string, { remoteRevision: number | null }>,
): void {
  try {
    const toStore: Record<string, number> = {}
    for (const [tripId, entry] of Object.entries(byTripId)) {
      if (entry.remoteRevision !== null) toStore[tripId] = entry.remoteRevision
    }
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(toStore))
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}
