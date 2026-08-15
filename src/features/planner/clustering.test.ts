import { describe, it, expect } from 'vitest'
import { clusterPlaces, focusBounds, type ClusterInput } from './clustering'

const PARIS: [number, number] = [2.3522, 48.8566]

// A tight knot of `n` points jittered ~150 m around a center — well inside the
// 700 m epsilon, so it must come back as one cluster.
function knot(prefix: string, center: [number, number], n: number): ClusterInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    coord: [center[0] + (i - n / 2) * 0.0015, center[1] + (i % 2) * 0.0012] as [number, number],
  }))
}

describe('clusterPlaces', () => {
  it('recovers four neighborhoods from twenty pins (Phase 4 verify)', () => {
    const places = [
      ...knot('a', [2.333, 48.854], 5), // Saint-Germain
      ...knot('b', [2.362, 48.859], 5), // Marais
      ...knot('c', [2.312, 48.872], 5), // Montmartre-ish
      ...knot('d', [2.349, 48.844], 5), // Latin Quarter-ish
    ]
    const { clusters, excursions } = clusterPlaces(places, PARIS)
    expect(clusters).toHaveLength(4)
    expect(excursions).toHaveLength(0)
    expect(clusters.every((c) => c.placeIds.length === 5)).toBe(true)
    // Every neighborhood gets a drawable blob.
    expect(clusters.every((c) => c.hull !== null)).toBe(true)
  })

  it('keeps a lone pin as its own one-place cluster (noise is not dropped)', () => {
    const places = [
      ...knot('a', [2.333, 48.854], 3),
      { id: 'lonely', coord: [2.3, 48.88] as [number, number] }, // ~3 km from the knot
    ]
    const { clusters } = clusterPlaces(places, PARIS)
    expect(clusters).toHaveLength(2)
    const solo = clusters.find((c) => c.placeIds.includes('lonely'))
    expect(solo?.placeIds).toEqual(['lonely'])
  })

  it('pulls a far-flung pin out as an excursion, not a neighborhood', () => {
    const places = [
      ...knot('a', [2.333, 48.854], 3),
      { id: 'versailles', coord: [2.1204, 48.8049] as [number, number] }, // ~17 km out
    ]
    const { clusters, excursions } = clusterPlaces(places, PARIS)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].placeIds).not.toContain('versailles')
    expect(excursions).toHaveLength(1)
    expect(excursions[0].placeIds).toEqual(['versailles'])
    expect(excursions[0].isExcursion).toBe(true)
  })

  it('groups multiple pins at one far site into a single excursion', () => {
    const places = [
      { id: 'v1', coord: [2.1204, 48.8049] as [number, number] },
      { id: 'v2', coord: [2.123, 48.806] as [number, number] }, // ~250 m away, same site
    ]
    const { excursions } = clusterPlaces(places, PARIS)
    expect(excursions).toHaveLength(1)
    expect(excursions[0].placeIds.sort()).toEqual(['v1', 'v2'])
  })

  it('returns empty for no places', () => {
    expect(clusterPlaces([], PARIS)).toEqual({ clusters: [], excursions: [] })
  })
})

describe('focusBounds', () => {
  // Same 20-pin/4-neighborhood fixture as the Phase 4 verify test above, plus
  // the excursion pin from the "pulls a far-flung pin out" test.
  const localPlaces = [
    ...knot('a', [2.333, 48.854], 5), // Saint-Germain
    ...knot('b', [2.362, 48.859], 5), // Marais
    ...knot('c', [2.312, 48.872], 5), // Montmartre-ish
    ...knot('d', [2.349, 48.844], 5), // Latin Quarter-ish
  ]
  const VERSAILLES: ClusterInput = { id: 'versailles', coord: [2.1204, 48.8049] } // ~17 km out
  const places = [...localPlaces, VERSAILLES]

  it('local add frames every local neighborhood, not just its own sub-cluster, and excludes the far excursion', () => {
    const focus: [number, number] = [2.3331, 48.8541] // inside Saint-Germain
    const bounds = focusBounds(places, PARIS, focus)
    expect(bounds).not.toBeNull()
    const [[minLng, minLat], [maxLng, maxLat]] = bounds as [[number, number], [number, number]]

    // Every local neighborhood is in frame — Marais and Montmartre-ish are
    // several blocks from the Saint-Germain focus (well beyond the 700 m
    // walking-radius epsilon), proving this doesn't over-narrow to just the
    // sub-cluster the focus belongs to.
    const localLngs = [...localPlaces.map((p) => p.coord[0]), focus[0]]
    const localLats = [...localPlaces.map((p) => p.coord[1]), focus[1]]
    expect(minLng).toBe(Math.min(...localLngs))
    expect(maxLng).toBe(Math.max(...localLngs))
    expect(minLat).toBe(Math.min(...localLats))
    expect(maxLat).toBe(Math.max(...localLats))
    // The genuinely far-away excursion pin (Versailles) stays out of frame —
    // this is the Item 4 bug the fix is for.
    expect(VERSAILLES.coord[0]).toBeLessThan(minLng)
  })

  it('frames tightly around focus alone when nothing local exists yet (first pin in a new area)', () => {
    const focus: [number, number] = [2.35, 48.86] // inside Paris, no places saved yet
    expect(focusBounds([], PARIS, focus)).toEqual([focus, focus])
  })

  it('excursion add frames only its own pocket, not the whole trip', () => {
    // Nowhere near central Paris or Versailles — a brand-new, unrelated excursion.
    const focus: [number, number] = [2.0, 49.2]
    expect(focusBounds(places, PARIS, focus)).toEqual([focus, focus])
  })

  it('excursion add merges into an existing nearby excursion pocket', () => {
    const focus: [number, number] = [2.123, 48.806] // ~250 m from Versailles, same site
    const bounds = focusBounds(places, PARIS, focus)
    expect(bounds).not.toBeNull()
    const [[minLng, minLat], [maxLng, maxLat]] = bounds as [[number, number], [number, number]]
    expect(minLng).toBe(Math.min(VERSAILLES.coord[0], focus[0]))
    expect(maxLng).toBe(Math.max(VERSAILLES.coord[0], focus[0]))
    expect(minLat).toBe(Math.min(VERSAILLES.coord[1], focus[1]))
    expect(maxLat).toBe(Math.max(VERSAILLES.coord[1], focus[1]))
  })
})
