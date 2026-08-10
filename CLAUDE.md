# CLAUDE.md

@CLAUDE.karpathy.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Junro (順路 — "the recommended route") is a visual trip planner: pin places, add hotels + dates, cluster neighborhoods, and order each day into an efficient loop. Full plans: [PROJECT_PLAN.md](PROJECT_PLAN.md) (v1, Phases 0–6) and [PLATFORM_PLAN.md](PLATFORM_PLAN.md) (backend, Phases 7–10).

## Commands

```bash
npm run dev       # start dev server (Vite, localhost:5173)
npm run build     # type-check + production build → dist/
npm run test      # Vitest, single run
npx tsc --noEmit  # type-check without building
```

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
- UI chrome colors are CSS custom properties written by `applyUiTheme` from the single Junro palette (`src/shared/constants/uiThemes.ts`, light + dark variants — vermilion accent, pine secondary). `index.css` uses only `var(--token)` / `rgba(var(--token-rgb), α)`.

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
