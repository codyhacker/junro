import type { PlaceCategory } from '../types/trip'

// Same hand-drawn glyph paths as the map pins (engine/icons.ts's GLYPHS), but
// colored via currentColor instead of the pins' fixed white-on-badge fill —
// for UI chrome (sidebar rows, the place detail panel) where CATEGORY_META's
// emoji read as loud, uncontrollable color next to the rest of the theme.
// Map pins are untouched; this is a separate, parallel presentation of the
// same shapes. Native <select><option> spots keep the emoji — browsers only
// render text inside <option>, not arbitrary SVG.
const PATHS: Record<PlaceCategory, string> = {
  restaurant:
    'M8.2 4.5c.4 0 .7.3.7.7v3.3c0 .3.4.3.4 0V4.5c0-.9 1.4-.9 1.4 0v3.9c0 1.1-.7 2-1.6 2.4v7.4c0 1.1-1.8 1.1-1.8 0v-7.4c-.9-.4-1.6-1.3-1.6-2.4V4.5c0-.9 1.4-.9 1.4 0v3.9c0 .3.4.3.4 0V5.2c0-.4.3-.7.7-.7zm7.1-.2c.5 0 .9.4.9.9v13.2c0 1.1-1.8 1.1-1.8 0v-4.9h-.9c-.5 0-.9-.4-.9-.9V8.5c0-2.3 1.2-4.2 2.7-4.2z',
  cafe: 'M6 6.8h9.2c.5 0 .9.4.9.9v.5h.9a2.3 2.3 0 0 1 0 4.6h-1.2a5 5 0 0 1-4.5 3.2h-1.4a5 5 0 0 1-4.8-4.1V7.7c0-.5.4-.9.9-.9zm10.1 2.8v1.8h.9a.9.9 0 0 0 0-1.8h-.9zM5.5 17.4h11.8c.9 0 .9 1.3 0 1.3H5.5c-.9 0-.9-1.3 0-1.3z',
  sight:
    'M4.6 5.2c2.3.9 4.9 1.4 7.4 1.4s5.1-.5 7.4-1.4c.6-.2.9.6.4.9-.5.4-1.1.7-1.7.9v2h-4.5v2.2h3.7c.8 0 .8 1.2 0 1.2h-.6l.6 5.8c.1.9-1.4 1-1.5.1l-.6-5.9h-6.4l-.6 5.9c-.1.9-1.6.8-1.5-.1l.6-5.8h-.6c-.8 0-.8-1.2 0-1.2h3.7V9h-4.5V7c-.6-.2-1.2-.5-1.7-.9-.5-.3-.2-1.1.4-.9zM10 9v2.2h4V9h-4z',
  shop: 'M9 8V7a3 3 0 0 1 6 0v1h1.6c.5 0 .9.4.9.8l.6 8.3c0 1-.7 1.9-1.8 1.9H7.7c-1.1 0-1.9-.9-1.8-1.9l.6-8.3c0-.4.4-.8.9-.8H9zm1.4 0h3.2V7a1.6 1.6 0 0 0-3.2 0v1zm-1.2 2.5a.8.8 0 1 0 1.1 1.1.8.8 0 0 0-1.1-1.1zm5.6 0a.8.8 0 1 0 1.1 1.1.8.8 0 0 0-1.1-1.1z',
  other: 'M12 4.8l1.8 5.4 5.4 1.8-5.4 1.8L12 19.2l-1.8-5.4-5.4-1.8 5.4-1.8L12 4.8z',
}

export function CategoryIcon({
  category,
  className,
}: {
  category: PlaceCategory
  className?: string
}) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={{ verticalAlign: 'middle' }}
    >
      <path d={PATHS[category]} />
    </svg>
  )
}
