import type { InteractiveLayer } from '../InteractiveLayer'
import { setHoveredPlace, setSelectedPlace } from '../../../../trip/tripInteractionSlice'

// Trip place pins — the top-priority hit target. Clicking empty map clears
// the selection (the scrapbook/panel close behavior mirrors silkymaps parks).
export const placesLayer: InteractiveLayer = {
  id: 'places',
  layerIds: ['places-pins'],
  hitMode: 'bbox',
  bboxPadding: 8,
  priority: 10,

  getHitKey: (f) => (f.id as string | number | undefined) ?? null,

  handle({ kind, hit, dispatch }) {
    const id = hit?.id != null ? String(hit.id) : null
    if (kind === 'hover') {
      dispatch(setHoveredPlace(id))
    } else {
      dispatch(setSelectedPlace(id))
    }
  },
}
