# CLAUDE.md

@CLAUDE.karpathy.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Junro (順路 — "the recommended route") is a visual trip planner: pin places, add hotels + dates, cluster neighborhoods, and order each day into an efficient loop. **Current status and what's next: [ROADMAP.md](ROADMAP.md)** (check this before assuming a phase below is deployed — Phase 7 in particular is built but deliberately not shipped, see its own section there). Progress log: [CHANGELOG.md](CHANGELOG.md). Original design docs: [PROJECT_PLAN.md](PROJECT_PLAN.md) (v1, Phases 0–6) and [PLATFORM_PLAN.md](PLATFORM_PLAN.md) (backend, Phases 7–10).

## Commands

```bash
npm run dev       # start dev server (Vite, localhost:5173)
npm run build     # type-check + production build → dist/
npm run test      # Vitest, single run
npx tsc --noEmit  # type-check without building
npm run format    # Prettier, write mode (npm run format:check for CI-style check)
```

Style: no semicolons, single quotes, trailing commas, 2-space indent (`.prettierrc.json`). `src/shared/constants/overturePlaceCategories.ts` is Prettier-ignored — it's a hand-aligned reference table; don't run a formatter on it.

**Verify gate** (run before every commit; `/check` and `/commit` use this): `npx tsc --noEmit && npm test -- --run && npm run build`

## Environment

`.env` in the project root:

```
VITE_MAPBOX_ACCESS_TOKEN=...
```

Deploys to GitHub Pages via `.github/workflows/deploy.yml` (`VITE_MAPBOX_ACCESS_TOKEN` comes from an Actions secret). `vite.config.js` sets `base: '/junro/'` accordingly.

## Architecture

One strict rule inherited from silkymaps: **React components never call Mapbox GL directly.** All map operations go through a command dispatch pattern:

```
Redux action → RTK Listener → engine.execute(MapCommand) → Controller method → map.*()
```

A second rule for async work: **services touch only HTTP; the engine touches only Mapbox GL.** Both are driven by listeners; both write results back through Redux.

### Basemap + theming (one theme, two modes)

- The basemap is **Mapbox Standard** — no basemap picker, no custom style builder. Dark/light maps to Standard's `lightPreset` (`night`/`day`) via `setConfigProperty`, so mode flips never reload the style. `showPointOfInterestLabels` is forced off so Mapbox's POI icons never compete with Junro pins.
- UI chrome colors are CSS custom properties written by `applyUiTheme` from the single Junro palette (`src/shared/constants/uiThemes.ts`, light + dark variants — moss-green accent, clay-terracotta secondary; earthy palette chosen 2026-08-16 to move away from the original vermilion). `index.css` uses only `var(--token)` / `rgba(var(--token-rgb), α)`. Display font is Space Grotesk (`--font-display`, geometric/technical); body stays Geologica (`--font-body`).

### Data flow for map state

`selectAugmentationSpec` (`engine/styleAugmentation.ts`) is the single selector deriving every Junro source/layer from Redux state. The listener middleware diffs spec references → `engine.execute({ type: 'STYLE_RECONCILE', spec })` → `StyleController` diffs at the style-spec level with `@mapbox/mapbox-gl-style-spec`'s `diff()` (including `setGeoJSONSourceData` for embedded GeoJSON sources). **Never add data layers directly in engine code — add them to the augmentation selector.** Custom layers must declare a `slot` (`'bottom' | 'middle' | 'top'`) — Standard's layer-ordering model.

### Persistence

- App prefs (`mapStyle`, `terrain`): debounced 400 ms write to `localStorage['junro:prefs']` via `store.subscribe` in `store.ts`.
- Trip documents (Phase 1+): all persistence goes through the async `TripStorage` adapter — nothing outside it touches `localStorage` for trips. Documents carry `schemaVersion`; ordered migrations run on load. Derived caches (routes, matrices, clusters) are never persisted.
- All entity ids are client-generated UUIDv7.

### File structure

```
src/
  app/            store.ts, hooks.ts, listenerMiddleware.ts, persist.ts, App.tsx
  features/
    map/          styleSlice.ts (uiMode), terrainSlice.ts, cameraSlice.ts
      engine/     MapEngine.ts, MapView.tsx, MapEngineContext.ts, commands.ts,
                  StyleController.ts, styleAugmentation.ts, registerListeners.ts,
                  pointer/ (InteractiveLayer, registerPointerRouter)
    shell/        ModeToggle.tsx, uiSlice.ts
  shared/
    constants/    uiThemes.ts (single Junro palette, light/dark)
```

### Adding a map capability

Add a command variant in `commands.ts` → add a case in `MapEngine.execute()` → implement in the right controller. Pointer interactions register as `InteractiveLayer`s with the pointer router (priority-ordered hit testing).

### External APIs (see PROJECT_PLAN.md §6 for the full decisions)

Mapbox Search Box (geocoding — results are never persisted; ToS), Directions + Matrix (walking/driving; responses cached in-memory only), Isochrone. POI browsing comes from a self-hosted Overture places PMTiles extract per destination. No Google APIs (ToS: must render on Google maps).

## Key contracts & naming

- **Command pattern is law.** React → Redux action → listener → `engine.execute()` → controller → `map.*()`. Never call Mapbox GL from a component. Never add a data source/layer in engine code — add it to `selectAugmentationSpec` (styleAugmentation.ts); `StyleController` diffs the spec and reconciles.
- **Services touch only HTTP; the engine touches only Mapbox GL.** Both driven by listeners, both write results back through Redux.
- **Persistence** goes through the async `TripStorage` adapter only. Ids are UUIDv7. Derived caches (routes, matrices, clusters) are **never persisted** — they re-derive from the document.
- **Undo/redo** is a store-level `withHistory` wrapper that snapshots `trip.active` on each edit. `setDayStops({dayId, placeIds})` claims those ids from every other day, so a same-day reorder and a cross-day move are each a single, atomic, undoable dispatch (see dndStops.ts).
- **Colours**: day ramp via `dayHexAt`/`dayRgbAt`/`dayColorAt` (shared/constants/dayColors.ts); category pin colours via `PIN_COLORS` (engine/icons.ts). Discovery dots reuse the pin colours. Map source-name constants live in `TripLayerController.ts` (`PLACES_SOURCE`, `DISCOVERY_SOURCE`, …).
- Custom layers must declare a `slot` (`'bottom' | 'middle' | 'top'`) — Standard's layer-ordering model.

## Gotchas (bite a fresh agent)

- **`dvh` height transitions freeze** in Chromium under a `flex`/`display:contents` chain — the height sticks at its start value. Animate with **inline px** heights, not `dvh` (see the mobile bottom sheet in PlanningPanel.tsx + `useViewportHeight`).
- **Style-spec expressions**: TS won't accept a spread-built `['match', …]`; type it and cast `as unknown as ExpressionSpecification`.
- **PMTiles**: a plain `https://…/x.pmtiles` URL on a `type:'vector'` source is auto-detected by Mapbox GL v3 (no `pmtiles://`, no `addProtocol`, no npm dep). The R2 bucket needs CORS allowing the origin + `Range`, exposing `Content-Range`/`Accept-Ranges`/`ETag`. Local dev goes through the Vite `/r2` proxy (vite.config.js) because the dev port isn't on the bucket's CORS allowlist; prod hits R2 directly. **The URL must be absolute, not root-relative** (`shared/constants/discovery.ts`, `PLACES_PMTILES_URL`) — Mapbox's PMTiles auto-detection derives the tile provider from the URL's extension via `new URL(url)` with no base argument, which throws on a relative string like `/r2/places.pmtiles`; the caught error silently falls back to treating the source as a TileJSON endpoint instead, which does a plain `Accept: application/json` GET with no `Range` header and pulls the _entire_ archive (860MB+) into memory in one shot — reliably crashes the tab ("Aw, Snap!"/renderer OOM). Prod's URL was always absolute (direct R2), so this was dev-only and easy to miss — reproduced and fixed 2026-08-15 by prefixing the dev proxy path with `window.location.origin`.
- **Automation-browser click/dispatch flakiness isn't just the tooling-exhaustion symptom below** — a `computer` click on a real button can silently no-op (no error, but the target Redux action never dispatches) even in a freshly-created tab. If a click "does nothing," verify via `window.__store.getState()` before assuming the app is at fault; retry via a fresh `tabs_create`, or bypass the UI entirely with `window.__store.dispatch({type: '...', payload: ...})` for the specific action, which has proven reliable when clicks weren't.
- **Dev handles**: `window.__store` and `window.__engine` are exposed in dev — read Redux state / the map from the browser console (`__engine.getMap()`).
- **CSS cascade order for viewport overrides**: a `@media (max-width: 640px)` block only wins if it appears **after** the unconditional rule it's meant to override — same specificity means later source position wins, regardless of media query. `index.css` interleaves mobile blocks throughout rather than grouping them at the end, so when adding a mobile override for an existing selector, check whether the base rule comes later in the file and would silently cancel it (found + fixed for `.date-range-pop`'s mobile bottom-sheet: the override was dead because the base rule was added afterward).
- **Verify gate**: `npx tsc --noEmit && npm test -- --run && npm run build`. The in-tool browser can become unreliable after **many `preview_stop`/`preview_start` cycles in one long session** — not just "WebGL exhaustion": `lsof -i :<port>` has shown 8+ stale ESTABLISHED connections from the automation browser's process to one dev server, well beyond what a single fresh tab needs. Symptom: clicks/taps hang for 30s+ regardless of which element or which app code is involved (reproduces identically on untouched pre-existing UI). If a "freeze" reproduces on a completely unrelated control, suspect tooling exhaustion before the app — check `lsof`, or verify via `window.__store`/DOM/`curl` instead of continued clicking. A full `preview_stop`+`preview_start` (new server) does _not_ fully clear it since the browser process itself persists; a brand-new tab (`tabs_create`) can help but isn't guaranteed.
- **Shell cwd can drift** — use absolute paths or `cd /…/junro` before `npm`/`npx` (else `tsc`/`vitest` "not found").
- **Deploy on push**: pushing `main` triggers the GitHub Pages build. `VITE_MAPBOX_ACCESS_TOKEN` is an Actions secret; never enter tokens/keys yourself.
- **Local git identity**: this machine's global `user.email` is the GitHub noreply address (`27780815+codyhacker@users.noreply.github.com`), fixed 2026-08-13 after commits were landing with an unverified `.local` fallback email (GitHub couldn't link them to `codyhacker`, so they rendered as an anonymous author — only the `Co-Authored-By: Claude Code` trailer resolved to a real profile). Should not recur, but if a commit's author looks wrong, check `git config --global user.email` first.

## Session workflow (Sonnet-driven, fresh-Opus plan/review)

The persistent thread runs **Sonnet**. For a feature: spawn the **`planner`** agent (fresh Opus) to prime memory + produce a batched plan → spawn **`implementer`** agents (Sonnet) for the separable tasks → spawn the **`reviewer`** agent (fresh Opus) to check the result → back to Sonnet. Prime + write **agent memory first** (durable notes: architecture, contracts, naming, gotchas — this file + the memory dir). Haiku slash commands handle chores (`/commit`, `/check`).

**Harness gotcha**: this environment's `Agent` tool does not expose `~/.claude/agents/*.md` as `subagent_type` options (confirmed — `planner`/`implementer`/`reviewer` all get "Agent type not found," only built-ins like `general-purpose` work). Work around it by reading the relevant `.md` file and inlining its persona/instructions directly into a `general-purpose` agent call, with `model` set to what the definition specifies (`opus` for planner/reviewer, `sonnet` for implementer). Don't waste a call rediscovering this.
