# Junro

*順路 — "the recommended route": the small arrow signs that guide you through a museum or garden in the ideal order.*

A visual trip planner. Pin the restaurants, cafes, and sights you want to hit, drop in your hotel and dates, and Junro clusters your pins into walkable neighborhoods, assigns them to days, and orders each day into an efficient loop from your hotel and back.

Built on the map architecture extracted from [silkymaps](../silkymaps): a strict command-pattern engine over Mapbox GL (React never touches the map directly), a single memoized selector deriving all map layers from Redux state, and a token-based theming system — collapsed here to one carefully-made theme with a dark/light toggle over Mapbox Standard's day/night presets.

## Quick start

```bash
npm install
echo "VITE_MAPBOX_ACCESS_TOKEN=your_token" > .env
npm run dev
```

## Plans

- [PROJECT_PLAN.md](PROJECT_PLAN.md) — v1: trip document, places scrapbook, days + routing, clustering + day suggestions, today view (Phases 0–6)
- [PLATFORM_PLAN.md](PLATFORM_PLAN.md) — accounts, sync, sharing, collaboration, security (Phases 7–10)

## License

MIT
