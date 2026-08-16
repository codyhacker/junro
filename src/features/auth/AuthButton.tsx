import { useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import type { RootState } from '../../app/store'
import { signInRequested } from './authSlice'
import { signOut } from './authService'
import { tripAdoptRequested } from '../trip/syncSlice'
import { TripPicker } from '../trip/TripPicker'

function selectShouldOfferLocalTripAdoption(state: RootState): boolean {
  const active = state.trip.active
  if (!active || state.auth.status !== 'signed-in') return false
  return (state.sync.byTripId[active.id]?.remoteRevision ?? null) === null
}

// Account entry point — sibling of ModeToggle, not nested in TripHeaderActions,
// so sign-in stays reachable even pre-trip (PLATFORM_PLAN Phase 7 / plan §7).
// Folds the local-trip "upload it?" adoption prompt into the same popover
// rather than a separate component.
export function AuthButton() {
  const dispatch = useAppDispatch()
  const status = useAppSelector((s) => s.auth.status)
  const user = useAppSelector((s) => s.auth.user)
  const signInRequest = useAppSelector((s) => s.auth.signInRequest)
  const shouldOfferAdoption = useAppSelector(selectShouldOfferLocalTripAdoption)
  const activeTripId = useAppSelector((s) => s.trip.active?.id)
  const syncEntry = useAppSelector((s) =>
    activeTripId ? s.sync.byTripId[activeTripId] : undefined,
  )

  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [adoptionDismissed, setAdoptionDismissed] = useState(false)
  const [showTripPicker, setShowTripPicker] = useState(false)

  // Auto-open once the adoption prompt first applies, then never again this
  // mount. Can't use empty deps to mean "check once at mount": auth.status is
  // still 'unknown' at mount (Supabase defers its INITIAL_SESSION callback,
  // especially on the magic-link-return/PKCE flow), so shouldOfferAdoption is
  // always false on the very first render — a mount-only effect would just
  // never fire. Re-run on every change instead, latched by the ref so a later
  // "Not now" doesn't get silently re-opened by an unrelated re-render.
  const autoOpenedRef = useRef(false)
  useEffect(() => {
    if (shouldOfferAdoption && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      setOpen(true)
    }
  }, [shouldOfferAdoption])

  const signedIn = status === 'signed-in'

  return (
    <div className="auth-button-wrap">
      <button
        className="auth-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={signedIn ? 'Account' : 'Sign in'}
        title={signedIn ? (user?.email ?? 'Account') : 'Sign in'}
      >
        {signedIn ? (user?.email?.[0]?.toUpperCase() ?? '@') : '@'}
      </button>

      {open && <div className="trip-head-scrim" onClick={() => setOpen(false)} />}

      {open && (
        <div className="trip-head-pop auth-pop">
          {signedIn ? (
            <div className="auth-pop-section">
              <span className="auth-pop-email">{user?.email}</span>
              <button
                className="junro-secondary"
                onClick={() => {
                  setShowTripPicker(true)
                  setOpen(false)
                }}
              >
                Your trips
              </button>
              <button
                className="junro-secondary"
                onClick={() => {
                  void signOut()
                }}
              >
                Sign out
              </button>
              {syncEntry?.status === 'error' && (
                <span className="auth-pop-status auth-pop-status-error">
                  Sync error: {syncEntry.lastError ?? 'unknown error'}
                </span>
              )}
              {syncEntry?.status === 'pushing' && <span className="auth-pop-status">Syncing…</span>}
            </div>
          ) : (
            <div className="auth-pop-section">
              <input
                className="junro-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="junro-primary"
                disabled={signInRequest.state === 'sending'}
                onClick={() => dispatch(signInRequested({ email }))}
              >
                Send magic link
              </button>
              {signInRequest.state === 'sent' && (
                <span className="auth-pop-status">Check your email for a link</span>
              )}
              {signInRequest.state === 'error' && (
                <span className="auth-pop-status auth-pop-status-error">{signInRequest.error}</span>
              )}
            </div>
          )}

          {signedIn && shouldOfferAdoption && !adoptionDismissed && activeTripId && (
            <div className="auth-pop-adopt">
              <span>You have a local trip not backed up — upload it?</span>
              <div className="auth-pop-adopt-row">
                <button className="junro-secondary" onClick={() => setAdoptionDismissed(true)}>
                  Not now
                </button>
                <button
                  className="junro-primary"
                  onClick={() => dispatch(tripAdoptRequested({ tripId: activeTripId }))}
                >
                  Upload it
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showTripPicker && <TripPicker onClose={() => setShowTripPicker(false)} />}
    </div>
  )
}
