# Junro — Roadmap

Where the project actually stands, and what's worth doing next. [CHANGELOG.md](CHANGELOG.md) is the record of what shipped; this is the forward-looking companion — update it as priorities change rather than letting it drift the way the phase docs below did.

Relationship to the older planning docs: [PROJECT_PLAN.md](PROJECT_PLAN.md) (v1 design, Phases 0–6) and [PLATFORM_PLAN.md](PLATFORM_PLAN.md) (backend design, Phases 7–10) still hold the detailed _design rationale_ — domain model, clustering algorithm, external API decisions, security model — and are worth reading for that. They're no longer accurate as a status tracker (e.g. PROJECT_PLAN.md's Phase 6 note claiming an action-log already exists for sync rebase was aspirational text that was never true of the shipped code — discovered the hard way while scoping Phase 7). This doc is the status tracker now.

---

## Where things stand

**v1 (PROJECT_PLAN.md Phases 0–5) is fully shipped and has had substantial usability investment beyond the original plan** — a full UX rework (left-column planning, map-hero grouping, location-first day suggestions) and two usability-review rounds (a tabbed Places/Plan/Trip shell, decluttered controls, mobile bottom sheet) on top of the original phases. The Overture Places discovery layer (browse + filter nearby POIs on the map, drag into the plan) shipped after that. This is the actual product today: a local-first, single-device trip planner with no account required, JSON export/import for backup and transfer.

**PLATFORM_PLAN.md Phase 7 (accounts + sync) has a foundation built and live-verified, including trip retrieval on a second device — not deployed yet, but no longer blocked on "is this worth shipping"** — see below.

Phases 8–10 (sharing, collaboration, hardening) and PROJECT_PLAN.md's Phase 6 backlog (transit routing, multi-city, opening-hours data, meal-time snapping, POI photos) are **not started**.

---

## The Phase 7 situation (read this before building more on top of it)

What's built and confirmed working against the live Supabase project:

- Schema + row-level security for `profiles`/`trips`, applied via migration
- Email magic-link sign-in/out
- Local-trip "adoption" (first upload) with a real client-generated UUIDv7 and server-assigned revision
- Debounced push on edit, with a genuine compare-and-swap revision counter enforced by a database trigger — a concurrent edit is always _detected_, never silently overwritten
- Conflict surfaced to the user to resolve by hand ("keep mine" / "use theirs") rather than auto-merged
- **A trip picker ("Your trips") that merges local and synced trips into one list** and loads any of them as the local active trip — closes what was actually the blocking gap: not just "no remote browse UI," but that a local-only trip became unreachable the moment you switched away from it (nothing ever listed anything but the currently-active trip). Local-only entries are labeled as such.
- **"+ New trip" from the picker, without deleting whatever trip is currently active** — building the picker surfaced that this never existed at all, signed in or not: the only prior way to start a new trip was "Start over," which deletes the current one. The creation form is now shared between the first-run screen and the picker. Scoped to signed-in use on purpose — trip management in general is an account-gated feature here, not something the signed-out path needs.
- **Remote trip delete** (soft delete via `deleted_at`, using the existing update RLS policy — no new migration needed) — reachable per-row in the picker for anything already synced, except the currently-active trip (switch away first). The CAS push path also now excludes soft-deleted rows, so an old push in flight can't accidentally resurrect a trip you just deleted.
- Regression tests targeting the specific race conditions this design has to get right

What's still explicitly not built, relative to PLATFORM_PLAN.md's original Phase 7 scope:

- OAuth providers (Google/Apple) — magic link only
- Account management (profile edit, account deletion, export-all-trips-at-once)
- Server-side shape validation of the trip document beyond Postgres CHECK constraints (no zod/Edge Function layer)
- An automated RLS test suite (verified manually against the live project instead)

None of these block the core value proposition anymore. **Signing in on a second device with no local copy of a trip now lets you actually retrieve it, and you can manage (create, switch, delete) every trip you have from one place** — the thing that made this strictly worse than JSON export before. That gap is closed; the remaining list above is about breadth (more sign-in options, account self-service, defense in depth) rather than "does this do anything useful."

**Still worth deciding on purpose:** does cloud sync get the next round of investment (closing the gaps above, or moving to Phase 8 sharing), or does the core planning experience (the Phase 6 backlog below) deserve it instead? Nothing about the backend work blocks the other — `LocalStorageTripStorage` stays the source of truth either way.

---

## Backlog (unordered, not started)

**Core planning (PROJECT_PLAN.md Phase 6):**

- Real transit routing (OTP/GTFS) — v1 only has a rough crow-flies estimate on long legs
- Multi-city trips
- Opening-hours data — `openDays`/`fixedTime` are user-entered today
- Meal-time snapping (restaurants scheduled near typical meal times)
- POI photos
- Social-media location capture (save a place from a shared link/tag)

**Backend (PLATFORM_PLAN.md Phases 8–10), all sequenced behind Phase 7 actually shipping:**

- Phase 8 — Sharing: role-scoped share links, a public read-only itinerary page, hide-lodging privacy toggle
- Phase 9 — Collaboration: realtime multi-editor, presence, trip history/restore
- Phase 10 — Hardening: dependency/CSP/CORS audit, backup restore drills, abuse controls, privacy review

---

## Keeping this current

When something ships: add an entry to CHANGELOG.md, and update the "Where things stand" section here if it changes the picture. When priorities shift, edit the backlog/decision-point sections directly rather than leaving them stale — that's the failure mode this doc replaces.
