import { describe, it, expect } from 'vitest'
import {
  haversineKm,
  roughTransitMinutes,
  TRANSIT_HINT_MIN_KM,
  TRANSIT_OVERHEAD_MIN,
  TRANSIT_SPEED_KMH,
} from './geo'

describe('haversineKm', () => {
  it('is zero for a point against itself', () => {
    expect(haversineKm([2.35, 48.86], [2.35, 48.86])).toBe(0)
  })

  it('matches a known city pair (Paris → London, ~343 km)', () => {
    const km = haversineKm([2.3522, 48.8566], [-0.1276, 51.5072])
    expect(km).toBeGreaterThan(340)
    expect(km).toBeLessThan(346)
  })

  it('measures a short intra-city hop (Louvre → Notre-Dame, ~1.3 km)', () => {
    const km = haversineKm([2.3376, 48.8606], [2.3499, 48.8530])
    expect(km).toBeCloseTo(1.28, 1)
  })

  it('is symmetric', () => {
    const a: [number, number] = [2.3376, 48.8606]
    const b: [number, number] = [2.3499, 48.8530]
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10)
  })

  it('handles a degree of latitude as ~111 km', () => {
    expect(haversineKm([0, 0], [0, 1])).toBeCloseTo(111.19, 1)
  })
})

describe('roughTransitMinutes', () => {
  it('stays quiet at or below the 1.5 km threshold', () => {
    expect(roughTransitMinutes(0.4)).toBeNull()
    expect(roughTransitMinutes(TRANSIT_HINT_MIN_KM)).toBeNull()
  })

  it('kicks in just past the threshold', () => {
    expect(roughTransitMinutes(1.51)).not.toBeNull()
  })

  it('is crow-flies at 25 km/h plus 12 minutes of overhead', () => {
    // 5 km → 12 min in motion + 12 min overhead.
    expect(roughTransitMinutes(5)).toBe(24)
    // 10 km → 24 + 12.
    expect(roughTransitMinutes(10)).toBe(36)
  })

  it('matches the formula for an arbitrary distance', () => {
    const km = 7.3
    expect(roughTransitMinutes(km))
      .toBe(Math.round((km / TRANSIT_SPEED_KMH) * 60 + TRANSIT_OVERHEAD_MIN))
  })

  it('turns the plan\'s cross-town example into a sane number', () => {
    // A leg long enough to read as an 80-minute walk should hint ~20-30 min.
    const hint = roughTransitMinutes(haversineKm([2.2945, 48.8584], [2.4021, 48.8730]))
    expect(hint).toBeGreaterThan(15)
    expect(hint).toBeLessThan(40)
  })
})
