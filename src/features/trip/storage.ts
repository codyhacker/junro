import type { Trip, TripSummary } from '../../shared/types/trip'

// All trip persistence flows through this adapter — nothing outside it
// touches storage for trips (PROJECT_PLAN.md §5.6). Async from day one so
// the future Remote/IndexedDB implementation changes zero call sites.
export interface TripStorage {
  list(): Promise<TripSummary[]>
  load(id: string): Promise<Trip | null>
  save(trip: Trip): Promise<void>
  remove(id: string): Promise<void>
}

export const TRIP_SCHEMA_VERSION = 1

// Ordered migrations, keyed by the version they migrate FROM. A doc at
// version N runs MIGRATIONS[N], then N+1, … until TRIP_SCHEMA_VERSION.
// Version 1 is the initial shape — the map stays empty until the shape
// actually changes.
type Migration = (doc: Record<string, unknown>) => Record<string, unknown>
export const MIGRATIONS: Record<number, Migration> = {}

export function migrateTrip(raw: unknown): Trip | null {
  if (raw === null || typeof raw !== 'object') return null
  let doc = raw as Record<string, unknown>
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 1
  if (version > TRIP_SCHEMA_VERSION) {
    // Written by a newer build (e.g. another tab mid-deploy). Refuse rather
    // than corrupt — the caller treats null as "not loadable".
    return null
  }
  while (version < TRIP_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return null
    doc = step(doc)
    version += 1
    doc.schemaVersion = version
  }
  return doc as unknown as Trip
}

// ─── localStorage implementation ─────────────────────────────────────────────
// Layout: `junro:trip:<id>` per document; `junro:trips:index` holds summaries
// so list() never deserializes full docs.

const INDEX_KEY = 'junro:trips:index'
const tripKey = (id: string) => `junro:trip:${id}`

export class LocalStorageTripStorage implements TripStorage {
  // Injectable for tests; window.localStorage in the app.
  constructor(private ls: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage) {}

  async list(): Promise<TripSummary[]> {
    try {
      const raw = this.ls.getItem(INDEX_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as TripSummary[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  async load(id: string): Promise<Trip | null> {
    try {
      const raw = this.ls.getItem(tripKey(id))
      if (!raw) return null
      const migrated = migrateTrip(JSON.parse(raw))
      // Persist the migrated shape so migrations run once, not on every load.
      if (migrated && migrated.schemaVersion !== (JSON.parse(raw) as Trip).schemaVersion) {
        await this.save(migrated)
      }
      return migrated
    } catch {
      return null
    }
  }

  async save(trip: Trip): Promise<void> {
    this.ls.setItem(tripKey(trip.id), JSON.stringify(trip))
    const index = (await this.list()).filter(s => s.id !== trip.id)
    index.unshift({
      id: trip.id,
      name: trip.name,
      destinationName: trip.destination.name,
      updatedAt: trip.updatedAt,
    })
    this.ls.setItem(INDEX_KEY, JSON.stringify(index))
  }

  async remove(id: string): Promise<void> {
    this.ls.removeItem(tripKey(id))
    const index = (await this.list()).filter(s => s.id !== id)
    this.ls.setItem(INDEX_KEY, JSON.stringify(index))
  }
}

// Lazy singleton — instantiating at module load would touch `localStorage`
// in non-browser contexts (Vitest under Node).
let instance: TripStorage | null = null
export function getTripStorage(): TripStorage {
  if (!instance) instance = new LocalStorageTripStorage()
  return instance
}
