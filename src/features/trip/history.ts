import type { Reducer, UnknownAction } from '@reduxjs/toolkit'
import type { Trip } from '../../shared/types/trip'

// Store-level undo/redo for the trip document (PROJECT_PLAN.md §8 Phase 5).
// A higher-order reducer wraps the combined root reducer and snapshots
// `trip.active` on every real edit — kept out of tripSlice so the slice stays
// a plain document reducer and any future feature that mutates the trip is
// undoable for free. Derived state (planner/isochrone) is intentionally not
// snapshotted: it re-derives from the restored document.

export interface HistoryState {
  past: Trip[]
  future: Trip[]
}

const initialHistory: HistoryState = { past: [], future: [] }
const HISTORY_LIMIT = 50

// Identity reducer so combineReducers accepts a `history` key; the wrapper
// below is what actually maintains it.
export const historyReducer: Reducer<HistoryState> = (state = initialHistory) => state

export const UNDO = 'history/undo'
export const REDO = 'history/redo'
export const undo = () => ({ type: UNDO })
export const redo = () => ({ type: REDO })

// Edits that must NOT create a checkpoint — hydration loads a doc, it isn't an
// edit; undo/redo restoring a doc isn't an edit either.
const NON_CHECKPOINT = new Set(['trip/tripHydrated'])

export function withHistory<S extends { trip: { active: Trip | null }; history: HistoryState }>(
  combined: Reducer<S>,
): Reducer<S> {
  return (state, action: UnknownAction): S => {
    if (state) {
      if (action.type === UNDO) {
        const { past, future } = state.history
        if (past.length === 0) return state
        return {
          ...state,
          trip: { ...state.trip, active: past[past.length - 1] },
          history: {
            past: past.slice(0, -1),
            future: state.trip.active ? [state.trip.active, ...future] : future,
          },
        }
      }
      if (action.type === REDO) {
        const { past, future } = state.history
        if (future.length === 0) return state
        return {
          ...state,
          trip: { ...state.trip, active: future[0] },
          history: {
            past: state.trip.active ? [...past, state.trip.active] : past,
            future: future.slice(1),
          },
        }
      }
    }

    const next = combined(state, action)
    // Starting over drops the trip — wipe the timeline too so a stray ⌘Z can't
    // resurrect the deleted trip.
    if (action.type === 'trip/resetTrip') {
      return { ...next, history: initialHistory }
    }
    const prevActive = state?.trip.active ?? null
    const nextActive = next.trip.active
    if (prevActive && nextActive && prevActive !== nextActive && !NON_CHECKPOINT.has(action.type)) {
      return {
        ...next,
        history: { past: [...next.history.past, prevActive].slice(-HISTORY_LIMIT), future: [] },
      }
    }
    return next
  }
}
