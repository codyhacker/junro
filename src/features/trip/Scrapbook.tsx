import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setScrapbookOpen } from '../shell/uiSlice'
import { setHoveredPlace, setSelectedPlace } from './tripInteractionSlice'
import { removePlace } from './tripSlice'
import { flyTo } from '../map/cameraSlice'
import { CATEGORY_META } from './categoryMeta'

// The unassigned-places scrapbook (right drawer). Hover a row ↔ highlight
// the pin; click → select + fly. Notes render as the subtitle — the
// "why did I save this?" line.
export function Scrapbook() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const open = useAppSelector(s => s.ui.scrapbookOpen)
  const selectedId = useAppSelector(s => s.tripInteraction.selectedPlaceId)

  if (!trip) return null
  const places = trip.places

  return (
    <>
      <button
        className="scrapbook-toggle"
        onClick={() => dispatch(setScrapbookOpen(!open))}
        aria-label="Toggle scrapbook"
      >
        ✂ {places.length > 0 && <span className="scrapbook-count">{places.length}</span>}
      </button>

      {open && (
        <aside className="scrapbook">
          <div className="scrapbook-head">
            <span className="scrapbook-title">{trip.name}</span>
            <span className="scrapbook-sub">{places.length === 0
              ? 'No places yet — search to start collecting'
              : `${places.length} place${places.length === 1 ? '' : 's'}`}</span>
          </div>
          <ul className="scrapbook-list">
            {places.map(p => (
              <li
                key={p.id}
                className={`scrapbook-row${p.id === selectedId ? ' selected' : ''}`}
                onMouseEnter={() => dispatch(setHoveredPlace(p.id))}
                onMouseLeave={() => dispatch(setHoveredPlace(null))}
              >
                <button
                  className="scrapbook-row-main"
                  onClick={() => {
                    dispatch(setSelectedPlace(p.id))
                    dispatch(flyTo({ center: p.coord, zoom: 15, duration: 1200 }))
                  }}
                >
                  <span className="scrapbook-emoji">{CATEGORY_META[p.category].emoji}</span>
                  <span className="scrapbook-texts">
                    <span className="scrapbook-name">{p.name}</span>
                    {p.notes && <span className="scrapbook-note">{p.notes}</span>}
                  </span>
                </button>
                <button
                  className="scrapbook-remove"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => dispatch(removePlace(p.id))}
                >×</button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  )
}
