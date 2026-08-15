import buffer from '@turf/buffer'
import { point } from '@turf/helpers'
import type { Polygon, MultiPolygon } from 'geojson'
import { haversineKm } from '../../shared/lib/geo'

// Stage 1 — neighborhood discovery (PROJECT_PLAN.md §7). Pure and synchronous:
// geographic distance is the right notion for "same neighborhood," so this
// makes ZERO API calls and runs on every scrapbook change. DBSCAN is
// hand-rolled over `haversineKm` so the epsilon is honest metres, not a
// projection artifact, and the excursion pre-filter + singleton handling stay
// explicit.

export interface ClusterInput {
  id: string
  coord: [number, number]
}

export interface Cluster {
  id: string // synthetic: `c{n}` local, `x{n}` excursion
  placeIds: string[]
  centroid: [number, number]
  hull: Polygon | MultiPolygon | null // soft blob for the map; null if unbuildable
  isExcursion: boolean
}

// Tunables — deliberately exported so they can be swept against a real trip
// (the Paris fixture) rather than guessed once (PROJECT_PLAN.md §8 dogfood).
export const CLUSTER_EPS_KM = 0.7 // a comfortable walking radius
export const CLUSTER_MIN_PTS = 2
export const EXCURSION_KM = 15 // beyond this from the destination = day trip
export const EXCURSION_EPS_KM = 2 // pins at one far site (Versailles) group loosely
export const HULL_PAD_KM = 0.12 // soft padding so the blob rounds past the pins

// DBSCAN → a label per input point: a cluster index ≥ 0, or -1 for noise.
function dbscan(coords: [number, number][], epsKm: number, minPts: number): number[] {
  const n = coords.length
  const labels = new Array<number>(n).fill(-2) // -2 = unvisited
  const neighbors = (i: number): number[] => {
    const out: number[] = []
    for (let j = 0; j < n; j++) {
      if (j !== i && haversineKm(coords[i], coords[j]) <= epsKm) out.push(j)
    }
    return out
  }

  let cluster = -1
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue
    const seeds = neighbors(i)
    if (seeds.length + 1 < minPts) {
      labels[i] = -1 // noise (may be claimed by a later cluster's expansion)
      continue
    }
    cluster++
    labels[i] = cluster
    const queue = [...seeds]
    for (let k = 0; k < queue.length; k++) {
      const j = queue[k]
      if (labels[j] === -1) labels[j] = cluster // border point
      if (labels[j] !== -2) continue
      labels[j] = cluster
      const more = neighbors(j)
      if (more.length + 1 >= minPts) queue.push(...more)
    }
  }
  return labels
}

function centroidOf(coords: [number, number][]): [number, number] {
  const sum = coords.reduce<[number, number]>((a, c) => [a[0] + c[0], a[1] + c[1]], [0, 0])
  return [sum[0] / coords.length, sum[1] / coords.length]
}

// A day-colored circle around a group of pins: centered on the centroid, sized
// to enclose the group with a little breathing room, floored so a tight cluster
// still reads. Circles are cleaner than tight polygon hulls for "this is the
// area for this day". Exported so day-groups wear the same treatment.
export function buildAreaCircle(coords: [number, number][]): Polygon | MultiPolygon | null {
  if (coords.length === 0) return null
  const center = centroidOf(coords)
  let radiusKm = 0.18 // floor so single/tight clusters still show
  for (const c of coords) radiusKm = Math.max(radiusKm, haversineKm(center, c) + HULL_PAD_KM)
  const circle = buffer(point(center), radiusKm, { units: 'kilometers', steps: 40 })
  return (circle?.geometry as Polygon | MultiPolygon | undefined) ?? null
}

function assemble(
  members: ClusterInput[],
  idPrefix: string,
  index: number,
  isExcursion: boolean,
): Cluster {
  const coords = members.map((m) => m.coord)
  return {
    id: `${idPrefix}${index}`,
    placeIds: members.map((m) => m.id),
    centroid: centroidOf(coords),
    hull: buildAreaCircle(coords),
    isExcursion,
  }
}

function clusterGroup(
  items: ClusterInput[],
  epsKm: number,
  minPts: number,
  idPrefix: string,
  isExcursion: boolean,
): Cluster[] {
  if (items.length === 0) return []
  const labels = dbscan(
    items.map((i) => i.coord),
    epsKm,
    minPts,
  )
  const byLabel = new Map<number, ClusterInput[]>()
  const noise: ClusterInput[] = []
  items.forEach((item, i) => {
    const label = labels[i]
    if (label < 0) {
      noise.push(item)
      return
    }
    const bucket = byLabel.get(label) ?? []
    bucket.push(item)
    byLabel.set(label, bucket)
  })

  const clusters: Cluster[] = []
  let n = 0
  for (const members of byLabel.values())
    clusters.push(assemble(members, idPrefix, n++, isExcursion))
  // A noise point is still a place you want to visit — it becomes a
  // one-place cluster rather than being dropped.
  for (const solo of noise) clusters.push(assemble([solo], idPrefix, n++, isExcursion))
  return clusters
}

export interface ClusterResult {
  clusters: Cluster[] // walkable neighborhoods near the destination
  excursions: Cluster[] // far-flung pins that deserve their own day trip
}

// Splits the pins into local neighborhoods and excursion candidates, then
// DBSCANs each group. `center` is the trip destination; a pin more than
// EXCURSION_KM from it is a day trip, not neighborhood noise.
export function clusterPlaces(places: ClusterInput[], center: [number, number]): ClusterResult {
  const local: ClusterInput[] = []
  const far: ClusterInput[] = []
  for (const p of places) {
    ;(haversineKm(p.coord, center) > EXCURSION_KM ? far : local).push(p)
  }
  return {
    clusters: clusterGroup(local, CLUSTER_EPS_KM, CLUSTER_MIN_PTS, 'c', false),
    // Excursions allow singletons (minPts 1): one pin at a far site is a valid
    // day trip on its own.
    excursions: clusterGroup(far, EXCURSION_EPS_KM, 1, 'x', true),
  }
}

function bboxOf(coords: [number, number][]): [[number, number], [number, number]] | null {
  if (coords.length === 0) return null
  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

// Camera-focus bbox for "the place being added right now" (AddPlace.tsx's
// `frame()`). Frames the local neighborhood or excursion pocket `focus`
// belongs to, not every saved place in the trip — that's the Item 4 bug
// (adding a Paris pin was pulling Versailles into frame). Deliberately reuses
// EXCURSION_KM, the coarse local/far split `clusterPlaces()` itself applies
// before its fine-grained DBSCAN, not CLUSTER_EPS_KM's walking radius — that's
// tuned for day-planning and would re-tighten the camera on every
// neighborhood-to-neighborhood add within the same city.
export function focusBounds(
  places: ClusterInput[],
  destinationCenter: [number, number],
  focus: [number, number],
): [[number, number], [number, number]] | null {
  if (haversineKm(focus, destinationCenter) <= EXCURSION_KM) {
    // The new place is local: frame every place in the same local/far split,
    // not just the ones near `focus` — a plain distance filter, no clustering
    // call needed.
    const local = places
      .filter((p) => haversineKm(p.coord, destinationCenter) <= EXCURSION_KM)
      .map((p) => p.coord)
    return bboxOf([...local, focus])
  }

  // The new place is itself a far-flung excursion point: group it with only
  // its own pocket (EXCURSION_EPS_KM), so a separate far site stays a
  // separate frame instead of merging every excursion into one wide shot.
  const { excursions } = clusterPlaces(
    [...places, { id: '__focus__', coord: focus }],
    destinationCenter,
  )
  const group = excursions.find((c) => c.placeIds.includes('__focus__'))
  const members = group
    ? places.filter((p) => group.placeIds.includes(p.id)).map((p) => p.coord)
    : []
  // Nothing else in this pocket falls back to a tight box around just
  // `focus` — the existing "first place in a new area" behavior.
  return bboxOf([...members, focus])
}
