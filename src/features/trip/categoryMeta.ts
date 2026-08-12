import type { PlaceCategory } from '../../shared/types/trip'

// UI-side category presentation (map pins use the SVG sprite in engine/icons.ts).
export const CATEGORY_META: Record<PlaceCategory, { label: string; emoji: string }> = {
  restaurant: { label: 'Restaurant', emoji: '🍴' },
  cafe: { label: 'Cafe', emoji: '☕' },
  sight: { label: 'Sight', emoji: '⛩️' },
  shop: { label: 'Shop', emoji: '🛍️' },
  other: { label: 'Other', emoji: '✦' },
}
