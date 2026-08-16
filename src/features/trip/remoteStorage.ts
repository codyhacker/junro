import type { Trip } from '../../shared/types/trip'
import { getSupabaseClient } from '../auth/supabaseClient'
import { migrateTrip, isStructurallyValidTrip } from './storage'

// Remote trip persistence against Supabase's `trips` table (see
// supabase/migrations/20260815000000_profiles_and_trips.sql). Plain exported
// functions, not a TripStorage implementation: TripStorage.save()'s
// Promise<void> signature can't express returning {conflict, serverTrip}
// instead of throwing. Nothing swaps getTripStorage() to point here — the
// sync layer (registerTripSync.ts) calls these directly, and
// LocalStorageTripStorage/getTripStorage() stay exactly as they are.
//
// `doc` stores the entire Trip verbatim (including its own redundant
// id/schemaVersion) rather than a stripped payload — migrateTrip needs a
// self-describing object, and `doc: trip` means zero transform logic that
// could introduce a bug.

export type SyncResult =
  | { ok: true; revision: number }
  | { conflict: true; serverTrip: Trip; serverRevision: number }
  | { ok: false; error: string } // network/RLS-denied/unexpected — distinct from a genuine conflict

export interface RemoteTripSummary {
  id: string
  name: string
  destinationName: string
  updatedAt: string
  revision: number
}

// For the trip picker — lists this account's synced trips without pulling
// full docs over the wire for a display-only list. Best-effort field
// extraction (a malformed doc just shows blank text) rather than running
// migrateTrip/isStructurallyValidTrip here: real validation happens when a
// trip is actually picked, via loadRemoteTrip.
export async function listRemoteTrips(ownerId: string): Promise<RemoteTripSummary[]> {
  const client = getSupabaseClient()
  if (!client) return []
  const { data, error } = await client
    .from('trips')
    .select('id, doc, updated_at, revision')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => {
    const doc = row.doc as { name?: string; destination?: { name?: string } } | null
    return {
      id: row.id as string,
      name: doc?.name ?? 'Untitled trip',
      destinationName: doc?.destination?.name ?? '',
      updatedAt: row.updated_at as string,
      revision: row.revision as number,
    }
  })
}

// Returns the doc and its revision together from one row read, not two
// separate requests — a conflict payload built from independent
// trip-then-revision fetches (the original design) can "tear" if a third
// write lands in the gap between them, pairing one writer's doc with a later
// writer's revision number. One query can't tear against itself.
export async function loadRemoteTrip(id: string): Promise<{ trip: Trip; revision: number } | null> {
  const client = getSupabaseClient()
  if (!client) return null
  const { data, error } = await client
    .from('trips')
    .select('doc, schema_version, revision')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return null
  const trip = migrateTrip(data.doc)
  // A remote doc is at least as untrusted as an imported JSON file (could've
  // been written by something hitting the API directly) — migrateTrip alone
  // only checks schemaVersion numerically, not shape.
  if (!trip || !isStructurallyValidTrip(trip)) return null
  return { trip, revision: data.revision }
}

export async function fetchRemoteRevision(id: string): Promise<number | null> {
  const client = getSupabaseClient()
  if (!client) return null
  const { data, error } = await client
    .from('trips')
    .select('revision')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return null
  return data?.revision ?? null
}

export async function adoptRemoteTrip(trip: Trip, ownerId: string): Promise<SyncResult> {
  const client = getSupabaseClient()
  if (!client) return { ok: false, error: 'Supabase not configured' }
  const { data, error } = await client
    .from('trips')
    .insert({ id: trip.id, owner_id: ownerId, doc: trip, schema_version: trip.schemaVersion })
    .select('revision')
    .single()
  if (error) {
    // Unique-violation on retrying an adopt that actually landed — treat as
    // success rather than surface a spurious failure. Fetch the real
    // revision rather than assuming 1: e.g. a trip already synced from
    // another device to revision 27, then imported here via JSON with no
    // local junro:sync entry, would otherwise get a knowingly-wrong 1
    // persisted (fails safe — the next push CAS-misses into a correct
    // conflict — but there's no reason to write a wrong number on purpose).
    if (error.code === '23505') {
      const revision = await fetchRemoteRevision(trip.id)
      if (revision != null) return { ok: true, revision }
      return { ok: false, error: 'adopt conflicted and the follow-up revision fetch failed' }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true, revision: data.revision }
}

export async function saveWithConflictCheck(
  trip: Trip,
  expectedRevision: number,
): Promise<SyncResult> {
  const client = getSupabaseClient()
  if (!client) return { ok: false, error: 'Supabase not configured' }
  // Must chain .select('revision').maybeSingle(): without .select(),
  // PostgREST's default response doesn't return affected rows, so success
  // and a CAS-lost zero-row update are both indistinguishable `data: null`.
  // .maybeSingle() (not .single()) returns null on zero rows instead of
  // throwing.
  const { data, error } = await client
    .from('trips')
    .update({ doc: trip, schema_version: trip.schemaVersion })
    .eq('id', trip.id)
    .eq('revision', expectedRevision)
    .is('deleted_at', null) // never resurrect a soft-deleted row via an ordinary push
    .select('revision')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (data) return { ok: true, revision: data.revision }
  // Zero rows updated: either another writer already bumped the revision (a
  // real conflict) or this write was RLS-denied (e.g. an expired session) —
  // the two look identical from here. One atomic fetch tells them apart; an
  // empty result means the latter.
  const remote = await loadRemoteTrip(trip.id)
  if (remote) return { conflict: true, serverTrip: remote.trip, serverRevision: remote.revision }
  return { ok: false, error: 'update rejected and follow-up fetch failed' }
}

// Soft delete — sets deleted_at rather than removing the row. Every read in
// this file already filters `deleted_at is null`, and the existing
// trips_update_own RLS policy (owner_id = auth.uid(), no column restriction)
// already permits this exact update, so no new migration/policy is needed.
// Never called for the currently-active trip (TripPicker won't offer it) —
// this only removes a trip from the account's list, it never touches
// anything in local storage.
export async function deleteRemoteTrip(id: string): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false
  const { error } = await client
    .from('trips')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}
