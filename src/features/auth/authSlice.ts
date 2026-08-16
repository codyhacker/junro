import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface AuthUser {
  id: string
  email: string | null
}

// Ephemeral — never persisted. Supabase's own client manages the real
// session (tokens) in its own storage; this slice mirrors only the minimal
// {id, email} shape components need, via bootAuthSession's subscription.
interface SignInRequest {
  email: string
  state: 'idle' | 'sending' | 'sent' | 'error'
  error?: string
}

interface AuthState {
  status: 'unknown' | 'signed-out' | 'signed-in' // 'unknown' until the SDK's first callback
  user: AuthUser | null
  signInRequest: SignInRequest
}

const initialState: AuthState = {
  status: 'unknown',
  user: null,
  signInRequest: { email: '', state: 'idle' },
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authStateChanged(state, action: PayloadAction<{ user: AuthUser | null }>) {
      state.status = action.payload.user ? 'signed-in' : 'signed-out'
      state.user = action.payload.user
    },
    signInRequested(state, action: PayloadAction<{ email: string }>) {
      state.signInRequest = { email: action.payload.email, state: 'sending' }
    },
    signInSent(state) {
      state.signInRequest.state = 'sent'
    },
    signInFailed(state, action: PayloadAction<{ error: string }>) {
      state.signInRequest.state = 'error'
      state.signInRequest.error = action.payload.error
    },
    signInDismissed(state) {
      state.signInRequest = { email: '', state: 'idle' }
    },
  },
})

export const { authStateChanged, signInRequested, signInSent, signInFailed, signInDismissed } =
  authSlice.actions
export default authSlice.reducer
