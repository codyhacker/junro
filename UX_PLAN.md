# Junro — UX Improvement Plan

*Companion to [PROJECT_PLAN.md](PROJECT_PLAN.md). v1 is feature-complete; this plan is a focused pass on how the app **feels** to use. Drafted 2026-08-11 from six pieces of feedback.*

## The through-line

All six notes point the same direction: **lead with place, not with the plan.** The hero of the screen should be *where your neighborhoods are* — the clusters — with the map quiet beneath them. Routing and the day-by-day schedule are **details you pull up per day**, not things shown all at once. And planning deserves a roomier home on the left, next to search, the way silkymaps' control panel sat.

So the redesign has one spine: **neighborhoods are the primary object; a day is a neighborhood; routing + schedule are drill-downs of a selected day.** Every workstream below serves that.

Current state it's correcting: every routed day draws its route simultaneously (crisscrossing colored lines), the day rail renders all days fully expanded at once (a wall of legs and controls), the basemap (Mapbox Standard, default theme) competes with the pins, and the planning rail is a cramped right-side drawer.

---

## Workstream 1 — Quiet the basemap *(feedback #3)*

**Problem.** Mapbox Standard's default theme is loud — saturated roads, transit, 3D buildings, dense labels. Junro's pins and hulls fight it for attention. We already hide Standard's own POI labels, but the *basemap* itself is still the busiest thing on screen.

**Design.** The basemap should recede to a canvas. Junro's saved places and neighborhood hulls become the figure; the map is ground.
- Set Standard's `theme: 'faded'` (desaturates the whole basemap so overlays pop while streets stay legible). `'monochrome'` is the fallback if faded still reads busy.
- Turn off `showTransitLabels` and `showPedestrianRoads`; drop `show3dObjects` (flat reads calmer at planning zoom and we only pitch during "fly the day").
- Keep road + place labels **on** but faded — planners need street context; this is not a blank canvas.

**Changes.** `StyleController.applyStandardConfig` (one place, all `setConfigProperty` calls) + the initial `config` block in `MapEngine`'s constructor. Config-only — no layer work.

**Verify.** Side-by-side both modes at z13–16: pins/hulls are unmistakably the focus; streets still legible; no console errors; mode toggle still flips cleanly.

*Smallest change, biggest immediate perceptual win — so it goes first.*

---

## Workstream 2 — Straightforward dates *(feedback #5)*

**Problem.** The date inputs are raw `type="date"` fields with no constraints. You can set an end before the start (→ zero days materialize, a silent dead end), and hotel check-in/out aren't bound to the trip, so you can book a hotel outside your own trip. (`clampLodgings` now repairs this *after* a trip-shrink, but the UI still lets you *enter* nonsense.)

**Design.** Make invalid input unreachable rather than repaired.
- **Trip range is always positive.** The end field gets `min={start}`; picking a start later than the current end bumps the end to match (or clears it). No "Apply" on a negative range.
- **Hotel ranges are bound to the trip.** Check-in/out inputs get `min={tripStart}` / `max={tripEnd + 1}` (checkout is the morning after the last night — the half-open convention `clampLodgings` already uses). Values clamp on change.
- **Sensible hotel default:** default checkout to `tripEnd + 1` (not `tripEnd`), so a one-hotel trip covers *every* night out of the box — fixes today's "last night shows No hotel."
- Keep the shrink-orphan confirmation; it's good.

**Changes.** `TripSettings.tsx` (date input `min`/`max` + the bump-end logic + the checkout default on `pickHotel`). Pure-ish UI; the reducers already hold the line.

**Verify.** Can't set end before start; hotel picker can't exceed the trip; a fresh full-trip hotel houses the last night; shrinking still orphans stops with the confirm.

*Small, isolated, removes a real footgun — so it goes early.*

---

## Workstream 3 — Planning moves left, day rows collapse *(feedback #6 + #4)*

These are one redesign of the planning surface, so they ship together.

**Problem.** The rail is a narrow right-side drawer (`right: 16px`) opened by a scissors button, while search sits top-left — planning and place-finding are on opposite sides. And inside it, `DayRail` renders **every day fully expanded** (all stops, every travel leg, transit hints, a mode dropdown, a fly button) — a dense wall the moment you have a few days.

**Design — left column (silkymaps echo).** One left-side planning column, search at its head:
- Search bar sits at the top of the column (it's how you add to the plan — it belongs with the plan).
- Below it: the trip header, then the day list, then the unassigned scrapbook.
- Wider and calmer than today's drawer; the map breathes to its right.
- Mobile keeps the bottom-drawer pattern (a left column doesn't fit a phone) — the same content, different container.

**Design — master/detail days.** One day open at a time (the silkymaps `DetailPanel` pattern the plan always intended):
- **Collapsed row (default):** day number · date · **neighborhood name** · activity count, and a single quiet line of the day's activities (names or category-emoji chips). Nothing else — no legs, no controls, no per-leg times.
- **Drill in (click):** that day expands to the full schedule — ordered stops with clock times, travel legs, transit hints, the mode toggle, reorder controls, and "fly the day." Selecting a day also drives the map (Workstream 4).
- Desktop: inline accordion expand. Mobile: the day detail takes over the drawer with a back affordance.

**Changes.** `App.tsx` (panel placement) + `index.css` (`.scrapbook` → left column; responsive rules); split `DayRail.tsx` into a compact `DayRow` and a `DayDetail`; `selectedDayId` already exists in `tripInteraction` and becomes the master/detail selector. Neighborhood names come from Workstream 5's cluster labels (until then, "Day 2 · 5 places").

**Verify.** Panel reads as a left column beside search; each collapsed day is a glanceable one/two lines; opening a day reveals the full schedule and nothing extra is shown for the others; one day open at a time; mobile drawer still works.

---

## Workstream 4 — Clustering-forward, routing on demand *(feedback #1)*

**Problem.** Routing is the loudest thing on the map: **all** routed days draw at once, so the screen is a tangle of colored lines — routing reads as the point, when the *grouping* is the point.

**Design.** Invert the visual hierarchy.
- **Clusters become the always-on hero.** Strengthen the hull treatment — more presence than today's 0.16 fill: a soft but confident day-colored fill, a clear label (neighborhood name + count), gentle separation from the basemap. When you look at the map with nothing selected, you see *your neighborhoods*, colored by day.
- **Routes are pulled up, not pushed at you.** A day's route line draws **only when that day is selected** (the drill-in from Workstream 3) or hovered. No selection → no route lines, just clusters + pins. This is the core of "routing available but not central."
- Optional **"show all routes"** toggle for the overview-minded, off by default.
- The selected day's cluster lifts (raised opacity / ring) to tie map ↔ sidebar.

**Changes.** `styleAugmentation.ts`: gate `selectDayRoutesGeoJSON` on `tripInteraction.selectedDayId` (+ the optional toggle); enrich the `cluster-hull-*` layers and add a hull-label symbol layer. `planner/selectors.ts`: cluster labels. `registerListeners`/`TripLayerController`: selected-day emphasis. No new engine commands — this rides existing selection state.

**Verify.** Default view = clusters + pins, zero route lines; selecting a day reveals exactly that day's route and lifts its cluster; deselect → routes gone; toggle shows all; the map never shows more than the selected day unless asked.

---

## Workstream 5 — Location-first day grouping *(feedback #2)*

**Problem.** The suggester's day grouping feels convoluted. It sorts clusters by must-see weight then size and fills days by capacity, so days don't map cleanly to neighborhoods and consecutive days can jump across the city. (Part of the *felt* convolution is Workstream 4's all-routes-at-once tangle; fixing that helps on its own — but the algorithm should also group more obviously by place.)

**Design.** Make a day *obviously* a neighborhood, and make the day order a walk across the map.
- **One neighborhood = one day** by default. Assign each cluster wholesale to a day; only split a cluster when it genuinely overflows a day's capacity (keep the k-means split as the exception, not a routine step).
- **Order days by a geographic sweep.** Chain clusters by proximity from the hotel (nearest-neighbor over centroids), assigning along the chain to consecutive days — Day 1 is the nearest neighborhood, Day 2 the next, so the trip flows across the city instead of ping-ponging.
- **Drop the opaque weighting.** Replace "must-weight then size" ordering with the spatial chain; keep open-day constraints and excursions-as-own-days as hard rules, not scoring nudges.
- **Name the neighborhoods.** Label each cluster (reverse-geocode the centroid once via Search Box, cached; fall back to "near \<nearest place\>"). Names feed the sidebar rows (Workstream 3) and hull labels (Workstream 4) and the suggestion diff, so grouping is legible everywhere — "Day 2 · Le Marais," not "Day 2 · 5 places."

**Changes.** `suggest.ts` (Stage 2: proximity-chain assignment replacing the weight sort; keep split-on-overflow); a small reverse-geocode + cache in the search feature; `clustering.ts` stays as-is (Stage 1 is fine — this is about how clusters map to days).

**Verify.** 4 tight neighborhoods → 4 days, each intact; day order steps across the map by proximity (assert the centroid sequence is a sensible chain in a unit test); an oversized neighborhood still splits; names show in rows, hulls, and the diff.

---

## Sequencing

Ordered by dependency and by win-per-effort:

1. **Workstream 1 — quiet basemap.** Config-only, isolated, instant perceptual payoff.
2. **Workstream 2 — dates.** Small, isolated, kills a footgun.
3. **Workstream 3 — left column + master/detail days.** The structural backbone; everything visual hangs off day-selection, which this establishes.
4. **Workstream 4 — clustering-forward / routes on demand.** Rides the day-selection from #3; delivers the headline "neighborhoods are the hero" feel.
5. **Workstream 5 — location-first grouping + neighborhood names.** Algorithm + naming; names also backfill the rows and hull labels from #3/#4.

1 and 2 are independent and could be done in either order (or together). 3 is the gate for 4. 5 can proceed in parallel with 3/4 but its *names* land best after 3/4 exist to show them.

---

## Decisions (resolved 2026-08-11)

1. **Routes-on-demand default (WS4).** ✅ **Selected day only** — no routes by default; the selected day's route appears on drill-in; off-by-default "show all routes" toggle.
2. **Day drill-down on desktop (WS3).** ✅ **Inline accordion** on desktop (day expands in place, others stay as collapsed rows); full-view on mobile.
3. **Search's home (WS3).** ✅ Search **heads the left column** — it's how you feed the plan.
4. **Grouping when clusters ≠ days (WS5).** ✅ Merge nearest-neighbors down to fit; **never silently drop places** — extras stay in the scrapbook with a note.
5. **Basemap theme (WS1).** ✅ **`faded`** (keeps enough color for orientation); revisit `monochrome` only if it still reads busy.

**Approach:** build all five in sequence, each committed + verified.
