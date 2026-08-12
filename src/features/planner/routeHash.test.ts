import { describe, it, expect } from 'vitest'
import { routeHash, canonicalRouteKey } from './routeHash'

const A: [number, number] = [2.3376, 48.8606]
const B: [number, number] = [2.3499, 48.853]
const C: [number, number] = [2.3212, 48.8467]

describe('routeHash — stability', () => {
  it('is identical for identical input', () => {
    expect(routeHash([A, B, C], 'walking')).toBe(routeHash([A, B, C], 'walking'))
  })

  it('survives a fresh array with the same numbers (unrelated re-render)', () => {
    const copy: [number, number][] = [[...A], [...B], [...C]] as [number, number][]
    expect(routeHash(copy, 'walking')).toBe(routeHash([A, B, C], 'walking'))
  })

  it('ignores float noise below the 6-decimal coordinate precision', () => {
    const nudged: [number, number] = [A[0] + 1e-9, A[1]]
    expect(routeHash([nudged, B], 'walking')).toBe(routeHash([A, B], 'walking'))
  })

  it('produces a fixed-width hex digest', () => {
    expect(routeHash([A, B], 'walking')).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('routeHash — invalidation', () => {
  it('changes when stops are reordered', () => {
    expect(routeHash([A, B, C], 'walking')).not.toBe(routeHash([A, C, B], 'walking'))
  })

  it('changes when the travel mode changes', () => {
    expect(routeHash([A, B, C], 'walking')).not.toBe(routeHash([A, B, C], 'driving'))
  })

  it('changes when a stop is added or removed', () => {
    expect(routeHash([A, B], 'walking')).not.toBe(routeHash([A, B, C], 'walking'))
  })

  it('changes when a coordinate actually moves', () => {
    const moved: [number, number] = [A[0] + 0.0001, A[1]]
    expect(routeHash([moved, B], 'walking')).not.toBe(routeHash([A, B], 'walking'))
  })

  it('distinguishes a closed loop from the open path (lodging at both ends)', () => {
    expect(routeHash([A, B, C, A], 'walking')).not.toBe(routeHash([A, B, C], 'walking'))
  })
})

describe('canonicalRouteKey', () => {
  it('encodes mode and the ordered path at fixed precision', () => {
    expect(canonicalRouteKey([[2.5, 48.5]], 'driving')).toBe('driving|2.500000,48.500000')
  })
})
