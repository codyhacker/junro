import { startAppListening } from '../../app/listenerMiddleware'
import { signInRequested, signInSent, signInFailed } from './authSlice'
import { requestMagicLink } from './authService'

// Reacts to one discrete action (the "Send magic link" click) — the
// actionCreator shorthand, not the predicate state-diff style
// registerRoutingListeners.ts uses, since there's no derived state to diff
// here. Sign-out needs no listener: AuthButton calls authService.signOut()
// directly, and the resulting state change arrives through the
// onAuthStateChange subscription already wired by bootAuthSession.
export function registerAuthListeners(): () => void {
  return startAppListening({
    actionCreator: signInRequested,
    effect: async (action, api) => {
      const result = await requestMagicLink(action.payload.email)
      api.dispatch(result.ok ? signInSent() : signInFailed({ error: result.error }))
    },
  })
}
