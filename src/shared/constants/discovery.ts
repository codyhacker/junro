// Discovery layer config — the filtered Overture "places" extract served as a
// single PMTiles archive over HTTP range requests (Mapbox GL v3's native
// PMTiles support; a plain https URL ending in `.pmtiles` is auto-detected —
// no `pmtiles://` prefix, no addProtocol, same as silkymaps' WDPA layer).
//
// The bucket is public and user-owned, so the R2 URL is a sensible default;
// override with VITE_PLACES_PMTILES_URL to point at another host. Empty ⇒ the
// discovery layer simply isn't declared.
const R2_DEFAULT = 'https://pub-e2d74adde0e44b6dbb3904fb4616f8b5.r2.dev/places.pmtiles'

// In dev, go through the Vite same-origin proxy (see vite.config.js `/r2`) so a
// local port that isn't on the bucket's CORS allowlist still works. Must be an
// *absolute* URL, not just `/r2/places.pmtiles`: Mapbox GL only recognizes a
// vector source as a raw PMTiles archive (read via byte-range requests) when
// its own url-extension check can `new URL(url)` the string with no base —
// that throws on a relative path and silently falls back to treating it as a
// TileJSON endpoint instead, which pulls the entire ~800MB+ archive in one
// plain GET (reproduced locally — this guards against regressing that). Prod
// is a static build and hits R2 directly (its origin is CORS-whitelisted),
// already absolute either way.
export const PLACES_PMTILES_URL =
  import.meta.env.VITE_PLACES_PMTILES_URL ||
  (import.meta.env.DEV
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r2/places.pmtiles`
    : R2_DEFAULT)

// The vector layer id inside places.pmtiles (from the file's own metadata).
export const DISCOVERY_SOURCE_LAYER = 'places'

// Dots appear at neighborhood zoom so the city overview stays quiet. The tiles
// themselves stop at z12; Mapbox overzooms them past that.
export const DISCOVERY_MIN_ZOOM = 13
