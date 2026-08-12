import { describe, it, expect } from 'vitest'
import { suggestDays } from './suggest'
import type { Cluster, ClusterResult } from './clustering'
import type { Day, Lodging, SavedPlace, TripPrefs } from '../../shared/types/trip'

const PREFS: TripPrefs = {
  travelMode: 'walking',
  dayStart: '09:00',
  dayEnd: '21:00',
  maxStopsPerDay: 6,
}
const HOTEL: Lodging = {
  id: 'L',
  name: 'Hotel',
  coord: [2.33, 48.85],
  checkIn: '2026-10-05',
  checkOut: '2026-10-12',
}

function place(id: string, coord: [number, number], extra: Partial<SavedPlace> = {}): SavedPlace {
  return {
    id,
    name: id,
    coord,
    category: 'sight',
    dwellMin: 60,
    priority: 'nice',
    source: 'user',
    ...extra,
  }
}
function day(id: string, date: string, extra: Partial<Day> = {}): Day {
  return { id, date, lodgingId: 'L', stopIds: [], locked: false, ...extra }
}
function cluster(
  id: string,
  placeIds: string[],
  centroid: [number, number],
  isExcursion = false,
): Cluster {
  return { id, placeIds, centroid, hull: null, isExcursion }
}
const weekdayOf = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay()

describe('suggestDays', () => {
  it('never assigns into a locked day, and keeps a neighborhood together', () => {
    const places = [
      place('a1', [2.33, 48.85]),
      place('a2', [2.331, 48.851]),
      place('b1', [2.37, 48.86]),
      place('b2', [2.371, 48.861]),
    ]
    const clusterResult: ClusterResult = {
      clusters: [
        cluster('cA', ['a1', 'a2'], [2.33, 48.85]),
        cluster('cB', ['b1', 'b2'], [2.37, 48.86]),
      ],
      excursions: [],
    }
    const days = [
      day('d1', '2026-10-05'),
      day('d2', '2026-10-06', { locked: true }),
      day('d3', '2026-10-07'),
    ]
    const { assignments } = suggestDays({
      clusterResult,
      days,
      places,
      lodgings: [HOTEL],
      prefs: PREFS,
    })

    expect(assignments.find((a) => a.dayId === 'd2')).toBeUndefined() // locked, untouched
    // Each neighborhood lands intact on one of the two open days.
    const byDay = new Map(assignments.map((a) => [a.dayId, a.placeIds.sort()]))
    const all = [...byDay.values()]
    expect(all).toContainEqual(['a1', 'a2'])
    expect(all).toContainEqual(['b1', 'b2'])
  })

  it('orders days by a proximity chain from the hotel (Day 1 = nearest)', () => {
    // Hotel at HOTEL.coord [2.33, 48.85]; three neighborhoods at increasing
    // distance. Day 1 should be the nearest, then step outward.
    const near = place('near', [2.335, 48.852])
    const mid = place('mid', [2.352, 48.861])
    const far = place('far', [2.372, 48.872])
    const places = [
      near,
      mid,
      far,
      place('near2', [2.336, 48.8515]),
      place('mid2', [2.353, 48.8615]),
      place('far2', [2.373, 48.8725]),
    ]
    const clusterResult: ClusterResult = {
      clusters: [
        cluster('cFar', ['far', 'far2'], [2.3725, 48.8722]),
        cluster('cNear', ['near', 'near2'], [2.3355, 48.8518]), // deliberately not first
        cluster('cMid', ['mid', 'mid2'], [2.3525, 48.8612]),
      ],
      excursions: [],
    }
    const days = [day('d1', '2026-10-05'), day('d2', '2026-10-06'), day('d3', '2026-10-07')]
    const { assignments } = suggestDays({
      clusterResult,
      days,
      places,
      lodgings: [HOTEL],
      prefs: PREFS,
    })

    const dayOf = (id: string) => assignments.find((a) => a.placeIds.includes(id))?.dayId
    // near → d1, mid → d2, far → d3 despite the clusters arriving far-first.
    expect(dayOf('near')).toBe('d1')
    expect(dayOf('mid')).toBe('d2')
    expect(dayOf('far')).toBe('d3')
  })

  it('gives an excursion its own driving day', () => {
    const places = [place('v1', [2.12, 48.8]), place('v2', [2.121, 48.801])]
    const clusterResult: ClusterResult = {
      clusters: [],
      excursions: [cluster('x0', ['v1', 'v2'], [2.12, 48.8], true)],
    }
    const days = [day('d1', '2026-10-05'), day('d2', '2026-10-06')]
    const { assignments } = suggestDays({
      clusterResult,
      days,
      places,
      lodgings: [HOTEL],
      prefs: PREFS,
    })

    expect(assignments).toHaveLength(1)
    expect(assignments[0].placeIds.sort()).toEqual(['v1', 'v2'])
    expect(assignments[0].travelModeOverride).toBe('driving')
  })

  it('splits an oversized cluster so no day exceeds maxStopsPerDay', () => {
    const places = Array.from({ length: 8 }, (_, i) =>
      place(`p${i}`, [2.33 + i * 0.001, 48.85 + (i % 2) * 0.001]),
    )
    const clusterResult: ClusterResult = {
      clusters: [
        cluster(
          'big',
          places.map((p) => p.id),
          [2.334, 48.8505],
        ),
      ],
      excursions: [],
    }
    const days = [day('d1', '2026-10-05'), day('d2', '2026-10-06')]
    const { assignments, unplacedPlaceIds } = suggestDays({
      clusterResult,
      days,
      places,
      lodgings: [HOTEL],
      prefs: PREFS,
    })

    expect(assignments.every((a) => a.placeIds.length <= PREFS.maxStopsPerDay)).toBe(true)
    const placed = assignments.flatMap((a) => a.placeIds)
    expect(placed.length + unplacedPlaceIds.length).toBe(8)
  })

  it("respects a must-see place's open days", () => {
    const days = [day('d1', '2026-10-05'), day('d2', '2026-10-06')]
    const openWeekday = weekdayOf('2026-10-06') // steer the museum onto d2
    const museum = place('m1', [2.33, 48.85], { priority: 'must', openDays: [openWeekday] })
    const clusterResult: ClusterResult = {
      clusters: [cluster('c', ['m1'], [2.33, 48.85])],
      excursions: [],
    }
    const { assignments } = suggestDays({
      clusterResult,
      days,
      places: [museum],
      lodgings: [HOTEL],
      prefs: PREFS,
    })

    const placedOn = assignments.find((a) => a.placeIds.includes('m1'))?.dayId
    expect(placedOn).toBe('d2')
  })
})
