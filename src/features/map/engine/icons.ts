import type { Map as MapboxMap } from 'mapbox-gl'
import type { PlaceCategory } from '../../../shared/types/trip'

// Category pin icons — one hand-drawn SVG per category, rasterized and
// registered via map.addImage. These are a primary carrier of the app's
// character (PROJECT_PLAN.md §5.3): a soft rounded pin badge in the category
// color with a white glyph. Colors are chosen to read on both Standard day
// and night, so one image set serves both modes.

export const PIN_COLORS: Record<PlaceCategory, string> = {
  restaurant: '#d6583e', // vermilion
  cafe: '#a9713a', // roasted amber
  sight: '#7161a8', // temple violet
  shop: '#49796b', // pine
  other: '#6d6f76', // stone
}

// 24×24 glyphs, white, drawn inside the badge.
const GLYPHS: Record<PlaceCategory, string> = {
  // fork + knife
  restaurant: `<path fill="#fff" d="M8.2 4.5c.4 0 .7.3.7.7v3.3c0 .3.4.3.4 0V4.5c0-.9 1.4-.9 1.4 0v3.9c0 1.1-.7 2-1.6 2.4v7.4c0 1.1-1.8 1.1-1.8 0v-7.4c-.9-.4-1.6-1.3-1.6-2.4V4.5c0-.9 1.4-.9 1.4 0v3.9c0 .3.4.3.4 0V5.2c0-.4.3-.7.7-.7zm7.1-.2c.5 0 .9.4.9.9v13.2c0 1.1-1.8 1.1-1.8 0v-4.9h-.9c-.5 0-.9-.4-.9-.9V8.5c0-2.3 1.2-4.2 2.7-4.2z"/>`,
  // coffee cup with saucer
  cafe: `<path fill="#fff" d="M6 6.8h9.2c.5 0 .9.4.9.9v.5h.9a2.3 2.3 0 0 1 0 4.6h-1.2a5 5 0 0 1-4.5 3.2h-1.4a5 5 0 0 1-4.8-4.1V7.7c0-.5.4-.9.9-.9zm10.1 2.8v1.8h.9a.9.9 0 0 0 0-1.8h-.9zM5.5 17.4h11.8c.9 0 .9 1.3 0 1.3H5.5c-.9 0-.9-1.3 0-1.3z"/>`,
  // torii gate
  sight: `<path fill="#fff" d="M4.6 5.2c2.3.9 4.9 1.4 7.4 1.4s5.1-.5 7.4-1.4c.6-.2.9.6.4.9-.5.4-1.1.7-1.7.9v2h-4.5v2.2h3.7c.8 0 .8 1.2 0 1.2h-.6l.6 5.8c.1.9-1.4 1-1.5.1l-.6-5.9h-6.4l-.6 5.9c-.1.9-1.6.8-1.5-.1l.6-5.8h-.6c-.8 0-.8-1.2 0-1.2h3.7V9h-4.5V7c-.6-.2-1.2-.5-1.7-.9-.5-.3-.2-1.1.4-.9zM10 9v2.2h4V9h-4z"/>`,
  // shopping bag
  shop: `<path fill="#fff" d="M9 8V7a3 3 0 0 1 6 0v1h1.6c.5 0 .9.4.9.8l.6 8.3c0 1-.7 1.9-1.8 1.9H7.7c-1.1 0-1.9-.9-1.8-1.9l.6-8.3c0-.4.4-.8.9-.8H9zm1.4 0h3.2V7a1.6 1.6 0 0 0-3.2 0v1zm-1.2 2.5a.8.8 0 1 0 1.1 1.1.8.8 0 0 0-1.1-1.1zm5.6 0a.8.8 0 1 0 1.1 1.1.8.8 0 0 0-1.1-1.1z"/>`,
  // compass star
  other: `<path fill="#fff" d="M12 4.8l1.8 5.4 5.4 1.8-5.4 1.8L12 19.2l-1.8-5.4-5.4-1.8 5.4-1.8L12 4.8z"/>`,
}

function pinSvg(category: PlaceCategory): string {
  const color = PIN_COLORS[category]
  // 36×44: rounded badge + short tail, subtle white rim for pop on any basemap.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
  <path d="M18 1.5c9.1 0 15 6 15 14.2 0 7.4-5.4 12.9-11.5 15.6L18 41.5l-3.5-10.2C8.4 28.6 3 23.1 3 15.7 3 7.5 8.9 1.5 18 1.5z"
        fill="${color}" stroke="#ffffff" stroke-width="2.4"/>
  <g transform="translate(6 4.5)">${GLYPHS[category]}</g>
</svg>`
}

export const CATEGORIES: PlaceCategory[] = ['restaurant', 'cafe', 'sight', 'shop', 'other']
export const iconName = (category: PlaceCategory) => `junro-pin-${category}`

// Rasterize + register every category pin. Idempotent; re-run safely after
// style resets. Images load async — callers don't need to await (Mapbox
// repaints symbol layers when a missing image is added).
export function registerPinIcons(map: MapboxMap): void {
  for (const cat of CATEGORIES) {
    const name = iconName(cat)
    if (map.hasImage(name)) continue
    const img = new Image(72, 88)
    img.onload = () => {
      if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 })
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSvg(cat))}`
  }
}
