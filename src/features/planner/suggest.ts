import clustersKmeans from '@turf/clusters-kmeans'
import { featureCollection, point } from '@turf/helpers'
import type { Day, Lodging, SavedPlace, TripPrefs } from '../../shared/types/trip'
import { haversineKm } from '../../shared/lib/geo'
import type { Cluster, ClusterResult } from './clustering'

// Stage 2 — cluster → day assignment (PROJECT_PLAN.md §7). Pure and
// explainable: greedy bin-packing that keeps neighborhoods together, respects
// locked days and open-day constraints, and never silently rewrites — the
// caller shows this as a diff the user applies or ignores.

// Fraction of a day's usable hours available for *dwelling* at stops; the rest
// is getting around. Rough on purpose — it only has to pack sanely.
const DWELL_FRACTION = 0.7

export interface DaySuggestion {
  dayId: string
  placeIds: string[]
  estimatedMinutes: number // dwell + rough travel, for the "~6h" label
  travelModeOverride?: 'driving' // excursions propose a driving day
}

export interface Suggestion {
  assignments: DaySuggestion[]
  unplacedPlaceIds: string[] // couldn't fit anywhere
}

interface SuggestInput {
  clusterResult: ClusterResult
  days: Day[]
  places: SavedPlace[]
  lodgings: Lodging[]
  prefs: TripPrefs
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function usableMinutes(day: Day, prefs: TripPrefs): number {
  const start = day.usableHours ? minutesOfDay(day.usableHours.start) : minutesOfDay(prefs.dayStart)
  const end = day.usableHours ? minutesOfDay(day.usableHours.end) : minutesOfDay(prefs.dayEnd)
  return Math.max(0, end - start)
}

function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay() // 0=Sun … 6=Sat
}

interface DaySlot {
  dayId: string
  weekday: number
  lodgingCoord: [number, number] | null
  remainingDwell: number
  remainingSlots: number
  assigned: string[]
  hasExcursion: boolean
}

// A pseudo-cluster produced by splitting an oversized one — same shape the
// placer consumes, minus the map hull it doesn't need.
interface Placeable {
  placeIds: string[]
  centroid: [number, number]
  isExcursion: boolean
}

function toPlaceable(c: Cluster): Placeable {
  return { placeIds: c.placeIds, centroid: c.centroid, isExcursion: c.isExcursion }
}

function summedDwell(placeIds: string[], byId: Map<string, SavedPlace>): number {
  return placeIds.reduce((sum, id) => sum + (byId.get(id)?.dwellMin ?? 60), 0)
}

function estimateMinutes(placeIds: string[], byId: Map<string, SavedPlace>): number {
  // dwell + a flat 18 min of getting between each stop.
  return summedDwell(placeIds, byId) + placeIds.length * 18
}

function mustPlacesOpen(
  placeIds: string[],
  weekday: number,
  byId: Map<string, SavedPlace>,
): boolean {
  return placeIds.every((id) => {
    const p = byId.get(id)
    if (!p || p.priority !== 'must' || !p.openDays || p.openDays.length === 0) return true
    return p.openDays.includes(weekday)
  })
}

// Split a cluster too big for one day into k geographic pieces via k-means.
function splitCluster(c: Placeable, k: number, byId: Map<string, SavedPlace>): Placeable[] {
  if (k <= 1 || c.placeIds.length <= 1) return [c]
  const pts = c.placeIds.map((id) => {
    const p = byId.get(id)!
    return point(p.coord, { id })
  })
  const fc = clustersKmeans(featureCollection(pts), {
    numberOfClusters: Math.min(k, c.placeIds.length),
  })
  const groups = new Map<number, string[]>()
  fc.features.forEach((f) => {
    const g = f.properties.cluster ?? 0
    const id = f.properties.id as string
    groups.set(g, [...(groups.get(g) ?? []), id])
  })
  return [...groups.values()].map((placeIds) => ({
    placeIds,
    centroid: centroid(placeIds, byId),
    isExcursion: c.isExcursion,
  }))
}

function centroid(placeIds: string[], byId: Map<string, SavedPlace>): [number, number] {
  const coords = placeIds.map((id) => byId.get(id)!.coord)
  const s = coords.reduce<[number, number]>((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0])
  return [s[0] / coords.length, s[1] / coords.length]
}

// Order pieces by a nearest-neighbor sweep from a start point (the hotel), so
// consecutive days step across the map instead of ping-ponging.
function chainOrder(pieces: Placeable[], start: [number, number]): Placeable[] {
  const remaining = [...pieces]
  const ordered: Placeable[] = []
  let cur = start
  while (remaining.length) {
    let bi = 0,
      bd = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cur, remaining[i].centroid)
      if (d < bd) {
        bd = d
        bi = i
      }
    }
    const [next] = remaining.splice(bi, 1)
    ordered.push(next)
    cur = next.centroid
  }
  return ordered
}

// When there are more neighborhoods than days, merge the nearest chain-adjacent
// pair repeatedly until they fit — never drop places (UX_PLAN.md WS5 decision).
function mergeToFit(
  pieces: Placeable[],
  maxCount: number,
  byId: Map<string, SavedPlace>,
): Placeable[] {
  const out = [...pieces]
  while (out.length > maxCount && out.length > 1) {
    let bi = 0,
      bd = Infinity
    for (let i = 0; i < out.length - 1; i++) {
      const d = haversineKm(out[i].centroid, out[i + 1].centroid)
      if (d < bd) {
        bd = d
        bi = i
      }
    }
    const placeIds = [...out[bi].placeIds, ...out[bi + 1].placeIds]
    out.splice(bi, 2, { placeIds, centroid: centroid(placeIds, byId), isExcursion: false })
  }
  return out
}

export function suggestDays({
  clusterResult,
  days,
  places,
  lodgings,
  prefs,
}: SuggestInput): Suggestion {
  const byId = new Map(places.map((p) => [p.id, p]))
  const lodgingById = new Map(lodgings.map((l) => [l.id, l]))
  const singleDayDwellCap = (usableMinutes(days[0] ?? ({} as Day), prefs) || 720) * DWELL_FRACTION

  // Mutable per-day capacity, seeded from any stops already on the day.
  const slots: DaySlot[] = days
    .filter((d) => !d.locked)
    .map((d) => {
      const existingDwell = summedDwell(d.stopIds, byId)
      const lodging = d.lodgingId ? lodgingById.get(d.lodgingId) : undefined
      return {
        dayId: d.id,
        weekday: weekdayOf(d.date),
        lodgingCoord: lodging?.coord ?? null,
        remainingDwell: usableMinutes(d, prefs) * DWELL_FRACTION - existingDwell,
        remainingSlots: prefs.maxStopsPerDay - d.stopIds.length,
        assigned: [],
        hasExcursion: false,
      }
    })

  const unplaced: string[] = []

  // ── Excursions first: each claims a whole empty day (driving). ──────────────
  for (const exc of clusterResult.excursions) {
    const day = slots.find(
      (s) =>
        !s.hasExcursion &&
        s.assigned.length === 0 &&
        s.remainingSlots >= exc.placeIds.length &&
        mustPlacesOpen(exc.placeIds, s.weekday, byId),
    )
    if (day) {
      day.assigned.push(...exc.placeIds)
      day.hasExcursion = true
      day.remainingSlots -= exc.placeIds.length
      day.remainingDwell -= summedDwell(exc.placeIds, byId)
    } else {
      unplaced.push(...exc.placeIds)
    }
  }

  // ── Local neighborhoods: one neighborhood per day, days ordered by a
  //    proximity chain from the hotel so consecutive days are adjacent
  //    (UX_PLAN.md WS5). Split what overflows a day; merge nearest to fit. ──────
  const emptySlots = slots.filter((s) => !s.hasExcursion && s.assigned.length === 0)

  // 1. Split any cluster too big for a single day into day-sized pieces.
  let pieces: Placeable[] = []
  for (const cluster of clusterResult.clusters.map(toPlaceable)) {
    const dwell = summedDwell(cluster.placeIds, byId)
    if (cluster.placeIds.length > prefs.maxStopsPerDay || dwell > singleDayDwellCap) {
      const k = Math.ceil(
        Math.max(cluster.placeIds.length / prefs.maxStopsPerDay, dwell / singleDayDwellCap),
      )
      pieces.push(...splitCluster(cluster, k, byId))
    } else {
      pieces.push(cluster)
    }
  }

  // 2. Order the pieces by a nearest-neighbor sweep from the hotel.
  const startCoord =
    emptySlots.find((s) => s.lodgingCoord)?.lodgingCoord ??
    (pieces.length ? pieces[0].centroid : null)
  if (startCoord) pieces = chainOrder(pieces, startCoord)

  // 3. If there are more neighborhoods than days, merge nearest to fit.
  pieces = mergeToFit(pieces, emptySlots.length, byId)

  // 4. Assign pieces to empty days in chain order — piece i prefers day i
  //    (nearest → Day 1), falling back to the nearest open-days-compatible day.
  const usedDay = new Set<number>()
  pieces.forEach((piece, i) => {
    const fits = (k: number) =>
      k >= 0 &&
      k < emptySlots.length &&
      !usedDay.has(k) &&
      mustPlacesOpen(piece.placeIds, emptySlots[k].weekday, byId)
    let target = fits(i) ? i : emptySlots.findIndex((_, k) => fits(k))
    if (target < 0) {
      unplaced.push(...piece.placeIds)
      return
    }
    usedDay.add(target)
    const s = emptySlots[target]
    s.assigned.push(...piece.placeIds)
    s.remainingSlots -= piece.placeIds.length
    s.remainingDwell -= summedDwell(piece.placeIds, byId)
  })

  const assignments: DaySuggestion[] = slots
    .filter((s) => s.assigned.length > 0)
    .map((s) => ({
      dayId: s.dayId,
      placeIds: s.assigned,
      estimatedMinutes: estimateMinutes(s.assigned, byId),
      ...(s.hasExcursion ? { travelModeOverride: 'driving' as const } : {}),
    }))

  return { assignments, unplacedPlaceIds: unplaced }
}
