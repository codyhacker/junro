import type { InteractiveLayer } from '../InteractiveLayer'
import { setAddCandidate } from '../../../../trip/tripInteractionSlice'
import { overtureToPlaceCategory } from '../../../../../shared/constants/overturePlaceCategories'

// Overture discovery dots — click one to hand it to the add flow (AddPlace
// opens the same confirm card as a search pick). Lower priority than saved
// pins; if a saved pin was hit at the same point it wins and we do nothing.
export const discoveryLayer: InteractiveLayer = {
  id: 'discovery',
  layerIds: ['discovery-dots'],
  hitMode: 'bbox',
  bboxPadding: 6,
  priority: 20,

  getHitKey: (f) => (f.properties?.id as string | undefined) ?? null,

  handle({ kind, hit, allHits, dispatch }) {
    if (kind !== 'click' || !hit) return
    if (allHits['places']) return // a saved pin was also under the cursor — it wins
    const p = hit.properties ?? {}
    const geom = hit.geometry
    if (geom.type !== 'Point') return
    const [lng, lat] = geom.coordinates as [number, number]
    dispatch(
      setAddCandidate({
        name: (p.name as string) || 'Unnamed place',
        coord: [lng, lat],
        address: (p.address as string) || undefined,
        category: overtureToPlaceCategory((p.category as string) || ''),
      }),
    )
  },
}
