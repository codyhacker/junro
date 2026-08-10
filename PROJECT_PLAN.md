# Junro — Project Plan

*A visual trip planner built on the silkymaps core map architecture.*

*Junro (順路): the "recommended route" — the small arrow signs that guide you through a museum or garden in the ideal order. Chosen 2026-08-09 after a collision survey of ~26 names; verified clean in the app space. The arrow motif is the natural seed for the app icon.*

Plan out a trip on a beautiful map: pin the restaurants, cafes, and sights you want to hit, drop in your hotel and dates, and let the app cluster your pins into neighborhoods, assign them to days, and order each day into an efficient walking loop from your hotel and back.

---

## 1. Assumptions

Stated up front per the working guidelines. Push back on any of these before Phase 0.

1. **New repo, not a fork.** We copy the reusable core out of silkymaps into a fresh repo rather than branching it — silkymaps stays a cartography sandbox; this is a product-shaped app.
2. **Same stack.** React 18 + TypeScript + Vite + Redux Toolkit + Mapbox GL JS v3.21+ (native PMTiles), Tailwind 4. No backend in v1 — the trip is a local-first document with JSON export. **Storage starts on localStorage** behind a `TripStorage` adapter (§5.6), with a planned move to a lightweight DB once the app earns it.
3. **Single traveler/party, single destination city per trip** in v1. Multi-city and collaboration are explicitly out of scope until Phase 6.
4. **Walking + driving routing in v1; transit gets honest hints, not routing.** Mapbox Directions has no transit profile, and doing transit right means OpenTripPlanner/GTFS — its own project (Phase 6). In metro cities, legs beyond ~1.5 km additionally display a clearly-labeled rough transit estimate (crow-flies at ~25 km/h + 12 min overhead) so a cross-town hop never reads as an 80-minute walk. Display-only — the optimizer stays walking/driving (§6, §7).
5. **Optimization is heuristic, not optimal.** Day assignment and stop ordering use DBSCAN + nearest-neighbor + 2-opt over a travel-time matrix. "Good and explainable" beats "provably optimal" for a trip planner.

---

## 2. Product definition

### Design principles

Drawn from what's wrong with the incumbent trip planners — **too busy, unpleasant to look at, and bad at this one specific use case** — and from what silkymaps is already good at (making a map *feel* like a place):

1. **The map is the product.** Visualizing the trip — pins, day colors, routes, neighborhood hulls — is the priority. Every feature must earn its place on the map before it earns a panel; lists support the map, never the reverse.
2. **Simple, and allowed to be cute — one theme, two modes.** One planning rail, one detail panel, one map, and **one carefully-made theme** with a dark/light toggle. No theme gallery — aesthetic variety is silkymaps' game, not Junro's. The basemap stays quiet and Streets-like so the trip is the loudest thing on screen; charm comes from category iconography, soft hulls, day colors, and motion. Charm is a feature; clutter is a bug.
3. **Few features, done properly.** The use case is "plan my days in a city, painlessly." Anything not serving it (budgets, bookings, reviews, checklists) stays out — the Phase 6 list is an anti-scope fence, not a backlog promise.
4. **Discovery and planning live in one place.** The places layer + category search make the map double as the discovery surface — browse cafes near the hotel, tap, save, done. No bouncing to Google Maps to find things and pasting them back.
5. **Time-to-first-plan is a metric.** A new trip needs a name and a destination — nothing else. Dates, hotel, and days can all arrive later; the scrapbook works from minute one. If a rough plan takes more than one sitting, we've failed.
6. **Navigation is not our job.** Street names must be legible (see the city-zoom cartography pass, Phase 1), but turn-by-turn belongs to the native maps apps the today view deep-links into.

### The core loop

The app is one map with a planning rail. The user journey:

1. **Create a trip** — name + destination (geocoded → map flies there). Dates are optional at creation: the scrapbook works dateless, and **Day** rows materialize in the planning rail whenever dates land (principle 5).
2. **Add lodging** — search for the hotel, pin it. Multi-hotel trips supported by giving each lodging a check-in/check-out range (the day's "anchor" is whichever hotel is active that night).
3. **Collect places** — search or browse POIs (restaurants, cafes, sights, stores). Saving one pins it to the map in an "unassigned" state. Every pin wears its **category icon** (cafe cup, restaurant fork, sight obelisk, store bag), and saving offers a one-line note — *why did I save this?* — that becomes the place's subtitle in the scrapbook. This is the scrapbook phase; the silkymaps favorites drawer is exactly this pattern.
4. **See structure emerge** — the app clusters saved pins into walkable neighborhoods and renders soft hulls around them, each themed from the data palette. An isochrone from the hotel shades what's within a 15/30/45-min walk.
5. **Plan days** — either drag pins onto days manually, or hit **"Suggest days"**: clusters are assigned to days (respecting hotel changes and place opening days), then each day is ordered hotel → stops → hotel by travel time. Each day gets a color; routes draw on the map.
6. **Refine** — reorder stops (route re-solves), move a stop between days, mark must-see vs optional. Per-stop dwell time yields a rough timeline per day.
7. **Preview & take it with you** — a "fly the day" camera animation walks the day's route (silkymaps' fly-along, repurposed). Export: JSON, printable itinerary view, share-URL later.

**North-star interaction:** every edit to the trip re-derives clusters/routes reactively — the user never presses "recalculate."

---

## 3. What carries over from silkymaps

The one strict rule survives unchanged: **React components never call Mapbox GL directly.**

```
Redux action → RTK listener → engine.execute(MapCommand) → Controller method → map.*()
```

### Carry over as-is (copy, minimal renames)

| silkymaps piece | Role in Junro |
|---|---|
| `engine/MapEngine.ts` (command dispatcher, worker fix, controller composition) | Same skeleton; swap park/trail controllers for trip controllers |
| `engine/commands.ts` discriminated-union pattern | Same; new command families (§5.4) |
| `engine/StyleController.ts` + `styleAugmentation.ts` reconcile-via-`diff()` | Same mechanism; the augmentation selector now derives POI pins, day routes, cluster hulls, isochrones from trip state |
| `engine/pointer/` (`InteractiveLayer`, `registerPointerRouter`, priority ordering) | Perfect fit: pins > route lines > cluster hulls, exactly the trails-over-parks precedence problem again |
| `shared/constants/uiThemes.ts` (UiPalette token system, `getEffectivePalette` dark/light modeling, `applyUiTheme`) | Keep the token *architecture* — every UI color stays a CSS var from one palette source; the theme gallery does not come along (see Adapt + Drop) |
| `shared/constants/dataPalettes.ts` | Becomes the day-color / cluster-color source — one categorical ramp with light/dark variants |
| `app/store.ts`, `listenerMiddleware.ts`, `hooks.ts`, `persist.ts` | Same shape; persist grows to hold the trip document |
| `features/map/{styleSlice,terrainSlice,cameraSlice}.ts` | Unchanged |
| `features/shell/` (uiSlice, MobileToggles, useUrlSync) | Unchanged pattern; URL sync now carries trip id + selected day |
| `DetailPanel.tsx` tab-container (both children stay mounted) | Becomes POI-detail / Day-detail tabs — same "two simultaneous selections" problem parks/trails already solved |
| Trail fly-along (`@turf/along` + RAF + gesture-cancel contract) | Repurposed as **"fly the day"** route preview |
| PMTiles build/host pipeline (tippecanoe → R2, CORS config) | Reused for a self-hosted **places layer** (§6) |

### Adapt

- **Theming system** → collapsed from four themes × two modes to **one Junro palette with dark/light variants** (decided: aesthetics matter, but they serve clarity here — no theme picker off the bat). `UI_THEMES` becomes a single entry, the ControlPanel Appearance section reduces to a mode toggle, and `UI_THEME_CHANGE` now means "mode flipped."
- **Favorites drawer** → the unassigned-places scrapbook (adds category icons, assign-to-day affordance).
- **Feature-state hover/select via `promoteId`** → same technique for POI pins (GeoJSON features get stable ids from the trip doc, so no promoteId gymnastics needed).
- **`UPDATE_GEOJSON` / `ADD_LAYER` command stubs** in `commands.ts` — silkymaps declared them "future"; this app is the future. They stay unused though: trip layers go through `selectAugmentationSpec` like everything else (the style-spec `diff()` emits `setGeoJSONSourceData` ops, so embedded-data GeoJSON sources reconcile cleanly).

### Drop

- WDPA parks data + `ParkController` + satellite polygon-clip overlay, trails pipeline + elevation profile, `parkMedia.ts` Wikipedia fetch (a variant may return for POI photos later), orbit tour. Also dropped with the single-theme decision: `buildCustomMapStyle` + `getCustomLayerPaints`, the 'earth' custom basemap, `basemaps.ts` + the basemap picker, and the `BASEMAP_CHANGE` command. Delete cleanly in Phase 0 — don't carry dead weight.

### Basemap (decided)

One basemap, no picker: **Mapbox Standard** — the current-generation successor to Streets, so "close to Mapbox Streets" by construction — with its **day/night light presets** mapped to Junro's light/dark toggle. Mode switching is a runtime `setConfigProperty`, no style reload, so augmentation layers survive untouched (the same live-switch feel silkymaps got from its theming machinery, at a fraction of the cost). Augmentation layers declare a `slot` (Standard's layer-ordering model) instead of before-ids. Two calibrations, not a cartography project: `showPointOfInterestLabels: false` — the basemap's own restaurant/cafe icons must never compete with Junro's pins — and a label-density check at planning zooms. UI chrome reads from the single Junro `UiPalette` (light + dark variants), tuned to sit beside Standard's colors. Documented fallback if Standard's slot model fights the reconcile pipeline: the Streets v12 + Dark v11 pair with a style swap on toggle (the reconciler already knows how to full-reapply after a style change).

---

## 4. Domain model

The **trip document** is the single source of truth and the unit of persistence/export. Clusters, routes, and timelines are **derived caches** — never persisted as authority, always recomputable.

```ts
interface Trip {
  id: string                   // UUIDv7, client-generated — all entity ids are
                               // (platform-plan prerequisite: server adoption
                               // without id remapping; see PLATFORM_PLAN.md §7)
  name: string
  destination: { name: string; center: [number, number]; bbox?: BBox }
  startDate?: string           // ISO date — optional at creation (principle 5);
  endDate?: string             // days materialize once both dates exist
  lodgings: Lodging[]
  places: SavedPlace[]         // the scrapbook — includes unassigned
  days: Day[]                  // materialized from date range
  prefs: { travelMode: 'walking' | 'driving'; dayStart: string; dayEnd: string;
           maxStopsPerDay: number }   // trip defaults — days may override (below)
}

interface Lodging {
  id: string
  name: string
  coord: [number, number]
  checkIn: string              // ISO date
  checkOut: string
}

interface SavedPlace {
  id: string
  name: string
  coord: [number, number]
  category: 'restaurant' | 'cafe' | 'sight' | 'shop' | 'other'
  address?: string
  notes?: string               // the "why did I save this?" line — prompted on
                               // save, shown as the scrapbook subtitle
  dwellMin: number             // default by category (cafe 45, restaurant 90, sight 120)
  priority: 'must' | 'nice'
  fixedTime?: string           // HH:mm — timed reservation (museum slot, dinner
                               // booking); a hard anchor the optimizer sequences
                               // around, never past (§7 Stage 3)
  openDays?: number[]          // 0–6; closed-on-Monday museums
                               // (openDays + fixedTime are user-entered in v1 —
                               // no opening-hours data source until Phase 6)
  source: 'user' | 'places-layer'   // provenance matters for ToS (§6)
  gersId?: string              // Overture GERS id when source is places-layer —
                               // canonical place identity; dedupes a Search Box
                               // re-save of the same spot
}

interface Day {
  id: string
  date: string
  lodgingId: string            // resolved from date ∩ lodging ranges
  stopIds: string[]            // ordered SavedPlace ids
  locked: boolean              // user hand-ordered; optimizer must not touch
  usableHours?: { start: string; end: string }  // arrival/departure half-days
  travelMode?: 'walking' | 'driving'            // excursion-day override
}

// Derived (planner state, not persisted):
// clusters: { id, placeIds, hull: Polygon, label }[]        — DBSCAN output
// dayRoutes: Record<dayId, { geometry, legs, totalMin }>    — Directions cache, keyed by hash(stop order + mode)
// matrix: travel-time seconds, keyed by hash(coord set + mode)
```

Design rules:

- **Days are materialized, not virtual** — editing trip dates runs an explicit reconcile (extend = append days; shrink = orphan stops back to the scrapbook with a confirmation).
- **`locked` days** are the contract between manual control and the optimizer: "Suggest days" never rewrites a locked day.
- **Route/matrix caches key on content hashes** so reordering stops invalidates exactly the affected day and nothing refetches on unrelated edits.

---

## 5. Architecture

### 5.1 Data flow

```
User edit (add place / move stop / change dates)
  → tripSlice reducer  (document mutation, persisted)
      → listener: selectClusters recomputes        (pure, turf DBSCAN — no I/O)
      → listener: route needs → RoutingService     (Directions/Matrix, cached, aborted on supersede)
          → plannerSlice.routeReady
      → listener: selectAugmentationSpec diff      → engine.execute(STYLE_RECONCILE)
```

The silkymaps pattern extends with one new concept: **async derivation services** (routing, geocoding) that sit outside the engine. Rule: the *engine* touches only Mapbox GL; *services* touch only HTTP; both are driven by listeners; both write results back through Redux. The `AbortController` discipline from `satelliteTiles.ts` (abort in-flight work when superseded) applies verbatim to route fetches.

### 5.2 Redux slices

| Slice | Owns | Persisted |
|---|---|---|
| `trip` | The trip document (+ trip list for multi-trip) | yes |
| `planner` | Derived: clusters, dayRoutes, matrix cache, optimizer status, suggestion diffs | no |
| `placeSearch` | Query, results, search session token | no |
| `tripInteraction` | Hovered/selected place id, selected day id, flyDayActive | no |
| `mapStyle` / `terrain` / `camera` / `ui` | As in silkymaps (`mapStyle` trims to little more than `uiMode` — no theme index, no basemap id) | as today |

### 5.3 Engine controllers

- **`TripLayerController`** — feature-state for hover/select on pins; fitBounds to a day or cluster. All layer/source *definitions* live in `selectAugmentationSpec` (category-icon pins with day-color coding, dashed unassigned state, route lines with casing, cluster hulls at low opacity, hotel marker, isochrone fill). The **category icon set** is one hand-drawn SVG per `SavedPlace['category']`, tinted for light/dark and registered via `map.addImage` at style load (through StyleController, honoring the no-direct-Mapbox rule); symbol layers reference icons by name — this iconography is a primary carrier of the app's character (principle 2).
- **`RoutePreviewController`** — "fly the day": `@turf/along` RAF walk over the day's route geometry, same user-gesture cancellation contract as the trail fly-along.

### 5.4 New commands

```ts
| { type: 'PLACE_SELECT';   placeId: string | null }
| { type: 'PLACE_HOVER';    placeId: string | null }
| { type: 'DAY_FOCUS';      dayId: string | null }     // fitBounds to day's stops+hotel
| { type: 'CLUSTER_FOCUS';  clusterId: string }
| { type: 'START_FLY_DAY';  dayId: string }
| { type: 'STOP_FLY_DAY';   restoreCamera?: boolean }
```

Everything else (STYLE_RECONCILE, UI_THEME_CHANGE — now meaning the dark/light mode flip — and the camera commands) is inherited untouched; BASEMAP_CHANGE is dropped along with the basemap picker.

### 5.6 Persistence — localStorage now, lightweight DB later (decided)

Storage is **localStorage in v1**, with an explicit migration path. Three rules make the later swap mechanical instead of a refactor:

```ts
interface TripStorage {
  list(): Promise<TripSummary[]>          // async from day one, even though
  load(id: string): Promise<Trip | null>  // localStorage is sync — so the DB
  save(trip: Trip): Promise<void>         // swap changes zero call sites
  remove(id: string): Promise<void>
}
```

1. **One adapter, async from day one.** All persistence goes through `TripStorage`; nothing outside the adapter ever touches `window.localStorage`. v1 ships `LocalStorageTripStorage`; the database step is now specced as a secondary implementation plan — **[PLATFORM_PLAN.md](PLATFORM_PLAN.md)** (Supabase-backed `RemoteTripStorage` + sync, accounts, sharing, collaboration, security) — which arrives through this same interface with zero call-site changes.
2. **Versioned document.** The trip doc carries `schemaVersion: number`; the adapter runs ordered migrations on load. This is needed for localStorage alone (the doc shape will evolve across phases) and doubles as the DB import path — migrating storage engines is just `list → load → save` through the new adapter.
3. **One write path.** Extend silkymaps' debounced `store.subscribe` persist (400 ms coalescing in `store.ts`) rather than adding per-feature writes: the trip slice serializes atomically per trip id (`trip:<id>`, plus a `trips:index` summary key so `list()` never deserializes full docs). Derived caches (`planner`) are never persisted, which keeps documents small — a realistic trip doc is a few KB, so the ~5 MB localStorage cap is years away; hitting it is the trigger to execute the swap, not a risk to engineer around now.
4. **One writing tab.** localStorage is shared across tabs, so two tabs on the same trip make the debounced writer a silent last-write-wins clobber. v1: a soft single-tab lock — tabs claim a trip via `BroadcastChannel`, later tabs open it read-only with a "being edited in another tab" notice. The upgrade path (`storage`-event merge) is a miniature of the Phase 7 sync problem and deliberately waits for that op-log machinery (PLATFORM_PLAN.md §4).

- **Planning rail** (left, collapsible; bottom drawer on mobile — reuse the ParkDetailPanel mobile pattern): trip header, day list with per-day stop timeline + total walking time, unassigned scrapbook at bottom.
- **DetailPanel** (right): Place tab (photo, notes, dwell, assign-to-day) / Day tab (ordered timeline, mode toggle, "fly the day", re-optimize button). Same both-mounted tab mechanics as parks/trails.
- **Map** owns: pins, hulls, routes, isochrones, hotel. Hover a rail row ↔ highlight on map (feature-state, both directions).

---

## 6. External data & APIs

The consequential decisions. Recommendation first, rationale after.

| Need | v1 choice | Why / constraints |
|---|---|---|
| Destination + hotel + address geocoding | **Mapbox Search Box API** (session-token billing) | Already on Mapbox; interactive autocomplete. **ToS caveat below.** |
| POI browsing (restaurants/cafes near X) | **Self-hosted Overture Maps places layer as PMTiles** | The silkymaps move: Overture places theme → tippecanoe → `places.pmtiles` on R2. Free, no rate limits, no storage restrictions, renders as a native vector layer themed by the palette. Category filtering is a layer filter expression — identical mechanics to the trails `surface`/`difficulty` filters. |
| Point-to-point routes | **Mapbox Directions API** (walking, driving) | Per-day: hotel + ≤10 stops fits one request (25-waypoint limit). Responses cached in-memory only — never persisted (same storage posture as geocoding). |
| Travel-time matrix | **Mapbox Matrix API** | 25 coordinates/request (10 for driving-traffic). A day is hotel + stops ≪ 25; whole-trip clustering over ~40 pins needs tiled requests or the haversine fallback (§7). |
| Reachability shading | **Mapbox Isochrone API** | Up to 4 contours, ≤60 min. One call per (lodging, mode). |
| Stop ordering | **Client-side NN + 2-opt** over the matrix | Mapbox Optimization v1 caps at 12 coordinates and adds a dependency; 2-opt on a ≤12-node day is trivial, free, transparent, and works offline on haversine. |
| Transit | **Rough hints in v1; routing deferred** | No Mapbox transit profile; real routing = OTP/GTFS infrastructure (Phase 6). Google Directions is off the table on ToS alone (results must render on a Google map). v1: legs > ~1.5 km show a heuristic estimate — crow-flies at ~25 km/h + 12 min overhead, labeled rough, computed locally, zero API calls. |

**⚠️ Mapbox geocoding storage ToS:** standard (temporary) geocoding results may not be stored persistently — and a saved trip document is persistent by definition. Mitigation, in order of preference:
1. POIs saved from the **Overture places layer** carry no restriction — make that the primary save path (hence `source` on `SavedPlace`).
2. For hotel/address pins from Search Box, store the **user's confirmed pin position** as user-generated content (user drops/adjusts the pin; we persist their pin, not the API response). Keep provenance honest via `source: 'user'`.
3. If it ever matters commercially: Mapbox permanent-geocoding endpoint (Enterprise) or a self-hosted geocoder (Pelias/Nominatim) — both out of v1 scope.

**Places-layer coverage strategy:** a *global* Overture places build is tens of GB — ruled out. Coverage is **per-destination extracts**: `scripts/build-places-pmtiles.sh <city-bbox>` (Overture download → category filter → tippecanoe → R2), run manually when you start planning a new city — the same workflow rhythm as silkymaps' trails pipeline. Extracts keep Overture's **GERS ids**, which serve as canonical place identity for deduping (§4).

**Cost posture:** map loads + search sessions + directions on free tiers comfortably cover a personal project; matrix/isochrone calls are cached in `planner` keyed by content hash, so the steady state after a planning session is ~zero API traffic.

**Alternatives shelf** (the full answer to "what external API options do we have" — understudies if Mapbox pricing or ToS ever shifts): Foursquare Places or Geoapify for POI search; Pelias or Photon (self-hosted) for geocoding; OSRM, Valhalla, or OpenRouteService for directions, matrices, and isochrones. All slot in behind the same service seams (§5.1) — swapping a provider is a service-file change, never an app change. Google's stack stays excluded regardless (ToS: results must render on a Google map).

---

## 7. Clustering & day-assignment design

Three explicit stages — each independently testable, each with an escape hatch to manual control.

**Stage 1 — Neighborhood discovery (pure, synchronous).**
`turf clustersDbscan` over saved pins, epsilon ≈ 600–800 m (a comfortable walking radius), minPoints 2. Pins beyond an excursion threshold (~15 km from the destination center) are excluded from DBSCAN entirely and grouped separately as **excursion candidates** — a Versailles pin is a day trip, not noise. Remaining noise points become single-place clusters. Output hulls (concave, fallback convex) rendered as soft themed fills. Runs on every scrapbook change — it's cheap and the visual feedback ("your pins form 4 neighborhoods") is the product's aha moment. *No API calls: geographic distance is the right notion for "same neighborhood."*

**Stage 2 — Cluster → day assignment (greedy, explainable).**
Inputs: clusters (with summed dwell times), days (active lodging + usable hours from the day's `usableHours` override, else `prefs` — arrival/departure half-days just have less capacity), place `openDays`/`priority`. Greedy bin-packing: sort clusters by must-see weight, then size; assign each to the day that (a) has capacity — both usable hours *and* the `maxStopsPerDay` cap, because a suggestion that stacks three museums back-to-back is optimal and inhumane, (b) whose lodging is nearest the cluster centroid, (c) satisfies open-day constraints for must-see places; split oversized clusters by k-means with k = ⌈dwell/day-capacity⌉. Each excursion candidate from Stage 1 proposes a dedicated day with a suggested `travelMode: 'driving'` override. Skip `locked` days. Output is a **suggestion diff** ("Day 2: Le Marais — 5 places, ~6h") the user applies or ignores — never a silent rewrite.

**Stage 3 — Intra-day ordering (matrix + 2-opt).**
Per day: travel-time matrix for [lodging, …stops] in the day's mode (override, else trip default) → nearest-neighbor tour from the lodging → 2-opt until no improving swap (n ≤ ~12, milliseconds) — with **`fixedTime` stops pinned**: anchors partition the day into segments and NN/2-opt permute only the free stops within each segment, so a booked 11:00 slot is honored, not optimized past. Then one Directions call for the final ordered route geometry + leg times. Haversine-at-5km/h stands in when offline or over matrix limits; timeline = day start + Σ(leg + dwell), snapping forward to each anchor's `fixedTime`, with a gentle overrun warning, not a hard block. Legs > ~1.5 km additionally display the rough transit hint (assumption 4) beside the walking time — display-only; it never enters the matrix or the ordering.

Meal-time snapping (restaurants near 12:30/19:30) is a Stage-3 post-pass — **Phase 6**, not v1.

---

## 8. Phased delivery

Each phase ends green: `npx tsc --noEmit` clean + the verification demo.

**Dogfood fixture: Paris** — cafes, the Louvre (a natural `fixedTime` anchor), stores. Entered in Phase 1; every later phase's verify runs against it (with Versailles as the excursion-day test when Phase 4 lands). Synthetic pins can't tell you the DBSCAN epsilon is wrong or a suggested day is inhuman — a trip you'd actually take can.

**Phase 0 — Extraction & scaffold** (the architectural surgery) ✅ *shipped 2026-08-09. Deploy note: the Pages workflow shipped and verified green, then was **disabled by decision** — development is local-only for now. Re-enable with `gh workflow enable "Deploy to GitHub Pages"` + set the `VITE_MAPBOX_ACCESS_TOKEN` Actions secret; Phase 5's today view is the natural forcing function.*
Copy `app/`, `engine/` (minus Park/Trail controllers), `shell/`, `shared/constants`, `shared/types` core; delete parks/trails features; collapse `UI_THEMES` to the single Junro palette (dark/light) and wire Mapbox Standard with day/night presets (basemap decision, §3); empty augmentation spec; wire an empty `trip` slice; copy silkymaps' GH Pages deploy workflow — **deployed from day one** (decided: Phase 5's today view needs a hosted URL anyway, and every phase becomes phone-testable), with the Mapbox token URL-restricted to the Pages domain from the first deploy.
✓ *Verify:* the Standard basemap renders with Junro chrome in both modes; the dark/light toggle flips map light preset + CSS vars in step, with no style reload; no console errors; no references to WDPA/trails remain (`grep -ri "wdpa\|trail\|park" src/` ≈ empty); push to main → live on the Pages URL.

**Phase 1 — Trip document & places** ✅ *shipped 2026-08-09 (all verifies passed against the Paris fixture)*
`trip` slice + `TripStorage` adapter (localStorage impl, `schemaVersion` + migration runner from day one, §5.6) + trip CRUD; destination geocode → flyTo; Search Box place search; save → category-icon pin renders via augmentation, with the "why did I save this?" note prompt; scrapbook drawer; place select/hover with feature-state; Place detail tab; **basemap calibration pass** — Standard is already street-tuned, so this is configuration rather than cartography: `showPointOfInterestLabels: false` so Mapbox's own POI icons never compete with Junro pins, plus a label-density/legibility check at planning zooms (z13–17) in both modes (navigation itself stays out per principle 6).
✓ *Verify:* search "café", save 3 with notes, reload browser — pins, icons, and scrapbook subtitles intact; hover rail row highlights pin and vice versa; street names readable at z15 in both modes, with no basemap POI icons competing with Junro pins.

**Phase 2 — Lodging, dates & days** ✅ *shipped 2026-08-09 (Opus agent build, Fable-reviewed + Opus-QA'd against the Paris fixture)*
Date range → materialized days; lodging with check-in/out and date-resolution to days; manual stop assignment (rail drag or detail-tab picker); day-color coding on pins; DAY_FOCUS fitBounds; date-change reconcile (orphan → scrapbook).
✓ *Verify:* 5-day trip, 2 hotels; each day resolves the correct lodging; assigning a place recolors its pin; shrinking the trip returns orphaned stops to the scrapbook with confirmation. — *all passed; known follow-up: lodging checkOut isn't clamped on shrink (cosmetic, tracked).*

**Phase 3 — Routing** ✅ *shipped 2026-08-09 (Opus agent build; both critical verifies passed under QA)*
RoutingService (Directions + cache + abort discipline); per-day hotel→stops→hotel route lines with day colors; leg/total times in Day tab; walking/driving toggle (trip default + per-day override); rough transit hints on legs > ~1.5 km; manual reorder re-solves only that day.
✓ *Verify:* reorder a stop — route redraws for that day only (network tab shows exactly one Directions call); toggle mode — all day routes re-solve; a cross-town leg shows both "78 min walk" and "~22 min transit (rough)"; offline reload degrades gracefully — stops render with dashed haversine connectors and routes re-solve on reconnect (route responses live in-memory only, per §5.6 and the same storage-ToS posture as geocoding). — *implemented as "no line drawn" rather than dashed connectors when a route is missing (per build brief); reorder-isolation confirmed as exactly one Directions call via instrumented fetch.*

**Phase 4 — Clustering & suggestion**
Stage 1 hulls live on the map; Matrix service; Stages 2–3 behind "Suggest days" with the suggestion-diff UI; `locked` days respected; 2-opt ordering on apply.
✓ *Verify:* 20 pins across 4 real neighborhoods → 4 hulls; suggestion assigns coherent days; total walking time after 2-opt ≤ naive scrapbook order (assert in a unit test with a fixed matrix fixture); locked day untouched.

**Phase 5 — Reachability & polish**
Isochrones from active lodging (15/30/45 walk); "fly the day" preview; printable itinerary view; **dark-mode route/ring contrast pass** (QA flagged the Day-color route lines + pin rings as legible-but-muted against the night basemap — the gold hues especially read as olive; bump line opacity/width or brighten casings for dark mode); mobile **"today" view** — a phone-sized read-only render of the current day (ordered stops, leg times, per-stop deep links into Google/Apple Maps for live navigation), built on the same viewer-mode discipline as the printable view — this is v1's answer to "the plan dies the moment the trip starts"; `.ics` calendar export (one event per stop); JSON export/import; undo/redo on the trip document (RTK + a bounded past-states stack — the document design makes this nearly free).
✓ *Verify:* isochrone matches hotel + mode; fly-day cancels on gesture like the silkymaps fly-along; today view shows the correct day in a mobile viewport and each stop deep-links into the native maps app; export → new browser → import → identical trip; ⌘Z reverses a "Suggest days" apply.

**Phase 6 — Later (explicitly out of v1)**
Transit (OTP/GTFS), multi-city, meal-time snapping, opening-hours data (until then `openDays`/`fixedTime` stay user-entered), POI photos, mobile app shell, the full day-of companion (live re-planning, offline tiles — v1's answer is Phase 5's today view + exports), and **social-media location capture** — save to a trip straight from a tagged location. Realistic shape: a PWA share-target / paste-a-link flow that extracts the place name and geocodes it into the scrapbook; there is no official Instagram/TikTok location API to build on, so this stays a capture affordance, not an integration. Backend sync, accounts, sharing, and collaboration have graduated from this bucket into their own plan: **[PLATFORM_PLAN.md](PLATFORM_PLAN.md)** (Phases 7–10, starting after Phase 5 ships). Two of its prerequisites land early here: UUIDv7 entity ids from Phase 1, and Phase 5's undo/redo keeping its serialized-action history (it becomes the sync rebase source).

Rough sizing: P0 small; P1–P3 medium each; P4 the interesting one; P5 medium. Nothing here fights the architecture — that's the payoff of the extraction.

---

## 9. Risks & open questions

| Risk | Exposure | Mitigation |
|---|---|---|
| Mapbox geocoding storage ToS | Persisted trip docs contain place coords | Overture layer as primary save path; user-pin provenance for the rest (§6) |
| Overture places quality varies by city | Sparse cafes in smaller destinations | Search Box fallback is always present; places layer is additive |
| Matrix 25-coord cap on big scrapbooks | Whole-trip optimization over 40+ pins | Cluster first (Stage 1 is API-free), matrix per day only — by design never near the cap |
| Suggestion feels wrong → trust loss | Users abandon auto-plan | Suggestion-diff + locked days keep the user in charge; heuristics are explainable ("grouped by neighborhood, ordered by walking time") |
| Route-cache staleness after edits | Ghost routes on map | Content-hash keys; hash mismatch = redraw as dashed "stale" until re-solve lands |
| Planning happens here, the trip happens in Google Maps | App abandoned the moment the trip starts | Phase 5 today view + native-maps deep links + `.ics` export make the plan usable on foot; full companion deferred to Phase 6 |
| No test runner in silkymaps heritage | Optimizer correctness is untestable by eye | Add Vitest in Phase 0; pure functions (DBSCAN params, bin-packing, 2-opt) are the test surface; engine/UI stay demo-verified |

**Open questions (answer before their phase, not before starting):**
1. ~~Trip document in localStorage vs IndexedDB?~~ **Resolved:** localStorage v1 behind the async `TripStorage` adapter, lightweight DB later (§5.6).
2. ~~Day colors: per-theme ramp or one ramp across themes?~~ **Resolved (and simplified by the single-theme decision):** one categorical day ramp in `dataPalettes.ts`, with light/dark variants.
3. ~~Does terrain/exaggeration survive into this app?~~ **Resolved:** keep — free via `terrainSlice`, and city maps at pitch with subtle terrain are on-brand.

*(All pre-implementation decisions are now closed — name: Junro; theming: one theme on Mapbox Standard, dark/light toggle only, no theme gallery; transit: rough hints; deploy: GH Pages from Phase 0; storage: localStorage → DB per PLATFORM_PLAN.md.)*

---

## 10. Bootstrap checklist (Phase 0, mechanical)

```bash
mkdir junro && cd junro && git init
npm create vite@latest . -- --template react-ts
# copy from silkymaps: vite.config.js, tsconfig*.json, tailwind setup,
#   .github/workflows/deploy.yml (GH Pages from day one — see Phase 0),
#   src/app/, src/features/map/{styleSlice,terrainSlice,cameraSlice}.ts,
#   src/features/map/engine/{MapEngine,MapView,MapEngineContext,commands,
#     StyleController,styleAugmentation,registerListeners,geometry}.*,
#   src/features/map/engine/pointer/{InteractiveLayer,registerPointerRouter}.ts,
#   src/features/shell/, src/shared/{constants,types,components}/
# strip: Park/Trail controllers + their commands/listeners/pointer layers,
#   parks/ trails/ panels/ favorites/ features, satelliteTiles.ts, parkMedia.ts
npm i @turf/clusters-dbscan @turf/clusters-kmeans @turf/convex @turf/distance
npm i -D vitest
# .env: VITE_MAPBOX_ACCESS_TOKEN=…  (PMTiles URL comes in Phase 1 with the places layer)
```

Keep silkymaps' CLAUDE.md conventions (command-pattern rule, augmentation-spec rule, no-direct-Mapbox rule) — write the new CLAUDE.md in Phase 0 so the rules are law from the first commit.
