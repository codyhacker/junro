# Changelog

Notable, user-visible progress on Junro, newest first. Grouped by what shipped, not by individual commit — see `git log` for the mechanical detail. Dates are commit dates.

## Unreleased

**Supabase-backed accounts + local-first sync.** Email magic-link sign-in; a `profiles`/`trips` schema with row-level security; local trips can be "adopted" (uploaded) once signed in; edits push to the server on a debounce with a real compare-and-swap revision counter, so a concurrent edit is always detected and surfaced for a human to resolve (never silently overwritten) rather than auto-merged. Built, migration applied to the live database, and live-verified end to end (sign-in, adoption, push, revision bump) — **not yet deployed**, see [ROADMAP.md](ROADMAP.md).

**A trip picker that actually manages your trips**, off the account button. Merges local and synced trips into one list — not just "browse the cloud," since a local-only trip became unreachable the moment you switched away from it (nothing ever listed anything but whatever was currently active, a gap that got worse once trips became easy to create). From the picker: open any trip, start a new one without losing the current one ("Start over" was the only prior option, and it deletes), and delete a trip's synced copy (soft delete, doesn't touch anything local). Last-updated dates shown per trip. Live-verified: local-only trips surfaced and reachable, switching trips, creating a trip without data loss to the previous one, and a mobile-viewport check of the picker itself.

Also fixed while building the picker: the CAS push path now excludes soft-deleted rows, so a push already in flight can't silently resurrect a trip that was just deleted.

Also fixed in this pass: a dev-only crash in the Discovery layer (Mapbox GL's PMTiles auto-detection needs an absolute source URL; the local dev proxy path was relative, so it silently fell back to pulling the entire ~800MB tileset into memory instead of reading it by byte range — production was never affected).

## 2026-08-15 — Discovery filters, camera fixes, visual polish

- Discovery category filters, quieter Fly-day camera move, day-colored suggestion preview, more balanced day-assignment
- Responsive branding mark; fixed the camera zooming out when switching between cities
- Hover-grown pins, a dedicated hotel marker, day-assign chips, list polish

## 2026-08-12 — Overture discovery layer + tooling

- **Overture Places discovery layer**: a self-hosted PMTiles extract of nearby POIs, browsable on the map and filterable by category, plus drag-and-drop from the Plan tab
- Unified the trip and hotel date pickers into one popover control
- Adopted Prettier and reformatted the codebase
- Documented the verify gate, architectural contracts, gotchas, and session workflow in CLAUDE.md

## 2026-08-11 — Usability overhaul: tabbed rebuild + UX plan completion

The UX improvement plan's remaining workstreams shipped, then two rounds of usability review drove a bigger rework:

- **UX plan (workstreams 3b–5, completing the 5-workstream plan started 2026-08-10)**: planning moved into a left column headed by search; grouping became the map's hero element with routing as a per-day drill-down; location-first day grouping with neighborhood labels and a suggestion-diff view
- **Usability review round 1**: cut/merged/automated several redundant toggles (per-day travel mode, "show all routes," dates apply-button), quieter monochrome basemap, single-calendar date-range picker, fixed a mobile mode-toggle collision and a dark-mode contrast issue
- **Usability review round 2 (tabbed rebuild)**: replaced the single long planning column with a tabbed shell — **Places** (the collector/scrapbook home), **Plan** (day-by-day), **Trip** (dates, lodging, settings) — plus a mobile bottom-sheet planning drawer and add-flow polish (pending-place marker, centered map fit, trip actions moved to the header)

## 2026-08-10 — Phase 5 shipped: v1 feature-complete, then a UX plan kicks off

- **Phase 5 — Reachability & polish**: isochrone reachability shading from the hotel, "fly the day" camera preview, a printable itinerary viewer, `.ics` calendar export, undo/redo on the trip document, and a dark-mode contrast pass on routes/rings — **v1 was feature-complete** as of this day
- Fixed lodging date clamping when the trip's date range shrinks
- First user feedback (6 items) turned into a 5-workstream UX improvement plan; workstreams 1–3a shipped same day (faded/quieter basemap, constrained date pickers, master/detail day rows)

## 2026-08-09 — v1 core: Phases 0–4

Built in one extended push, each phase verified against a real Paris trip fixture:

- **Phase 0 — Extraction & scaffold**: pulled the reusable map architecture (command-pattern engine, style-augmentation reconciler, theming) out of the silkymaps project into a fresh app; GitHub Pages deploy from day one
- **Phase 1 — Trip document & places**: the `Trip` document model, the async `TripStorage` adapter (localStorage-backed), destination search, place search + save with category icons and a "why did I save this?" note, the scrapbook
- **Phase 2 — Lodging, dates & days**: date ranges materializing into `Day` rows, multi-hotel support via check-in/out ranges, manual stop assignment, day color-coding
- **Phase 3 — Routing**: per-day hotel→stops→hotel routes via Mapbox Directions, walking/driving toggle, rough transit-time hints on long legs
- **Phase 4 — Clustering & suggestion**: DBSCAN neighborhood clustering with soft map hulls, excursion-day detection, the Matrix service, and "Suggest days" — greedy day assignment plus nearest-neighbor + 2-opt stop ordering, presented as a diff the user applies or ignores
- Assorted CI fixes (lockfile, Vitest/esbuild version pin)
