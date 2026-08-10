import { describe, it, expect } from 'vitest'
import { combineReducers, type Reducer } from '@reduxjs/toolkit'
import { withHistory, historyReducer } from './history'
import type { Trip } from '../../shared/types/trip'

// A stand-in trip reducer: 'setActive' replaces the doc, 'trip/tripHydrated'
// also replaces it (to prove hydration doesn't create an undo checkpoint).
type FakeTrip = { active: Trip | null }
const fakeTrip: Reducer<FakeTrip> = (state = { active: null }, action) => {
  if (action.type === 'setActive' || action.type === 'trip/tripHydrated') {
    return { active: (action as unknown as { payload: Trip }).payload }
  }
  return state
}

const reducer = withHistory(
  combineReducers({ trip: fakeTrip, history: historyReducer }) as unknown as Reducer<
    { trip: FakeTrip; history: { past: Trip[]; future: Trip[] } }
  >,
)
const trip = (id: string) => ({ id }) as unknown as Trip
const set = (id: string) => ({ type: 'setActive', payload: trip(id) })

describe('withHistory', () => {
  it('checkpoints edits and undoes/redoes them', () => {
    let s = reducer(undefined, { type: '@@init' })
    expect(s.trip.active).toBeNull()

    s = reducer(s, set('A'))       // null → A is not undoable
    expect(s.history.past).toEqual([])
    s = reducer(s, set('B'))       // A → B: checkpoint A
    expect(s.history.past).toEqual([trip('A')])

    s = reducer(s, { type: 'history/undo' })
    expect(s.trip.active).toEqual(trip('A'))
    expect(s.history.future).toEqual([trip('B')])

    s = reducer(s, { type: 'history/redo' })
    expect(s.trip.active).toEqual(trip('B'))
    expect(s.history.future).toEqual([])
  })

  it('a new edit after undo clears the redo stack', () => {
    let s = reducer(undefined, { type: '@@init' })
    s = reducer(s, set('A'))
    s = reducer(s, set('B'))
    s = reducer(s, { type: 'history/undo' })   // back to A, future = [B]
    s = reducer(s, set('C'))                    // A → C
    expect(s.trip.active).toEqual(trip('C'))
    expect(s.history.future).toEqual([])
    expect(s.history.past).toEqual([trip('A')])
  })

  it('hydration loads a doc without creating a checkpoint', () => {
    let s = reducer(undefined, { type: '@@init' })
    s = reducer(s, set('A'))
    s = reducer(s, set('B'))                     // past = [A]
    s = reducer(s, { type: 'trip/tripHydrated', payload: trip('X') })
    expect(s.trip.active).toEqual(trip('X'))
    expect(s.history.past).toEqual([trip('A')])  // unchanged — no checkpoint
  })

  it('undo/redo are no-ops at the ends of the stack', () => {
    let s = reducer(undefined, { type: '@@init' })
    s = reducer(s, set('A'))
    const beforeUndo = s
    s = reducer(s, { type: 'history/undo' })      // nothing to undo (null→A wasn't a checkpoint)
    expect(s).toBe(beforeUndo)
    s = reducer(s, { type: 'history/redo' })      // nothing to redo
    expect(s.trip.active).toEqual(trip('A'))
  })
})
