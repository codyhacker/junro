import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setScrapbookOpen } from '../shell/uiSlice'
import { setHoveredPlace, setSelectedPlace } from './tripInteractionSlice'
import { removePlace, assignStop } from './tripSlice'
import { flyTo } from '../map/cameraSlice'
import { CATEGORY_META } from './categoryMeta'
import { selectDays, selectUnassignedPlaces } from './selectors'
import { TripSettings } from './TripSettings'
import { DayRail, dayLabel } from './DayRail'

// The planning rail (right drawer): trip settings, the day list, and the
// unassigned scrapbook at the bottom. Hover a row ↔ highlight the pin; click
// → select + fly. Notes render as the subtitle — the "why did I save this?"
// line.
export function Scrapbook() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const open = useAppSelector(s => s.ui.scrapbookOpen)
  const selectedId = useAppSelector(s => s.tripInteraction.selectedPlaceId)
  const days = useAppSelector(selectDays)
  const unassigned = useAppSelector(selectUnassignedPlaces)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
            <div className="scrapbook-head-row">
              <span className="scrapbook-title">{trip.name}</span>
              <button
                className={`scrapbook-settings${settingsOpen ? ' active' : ''}`}
                aria-label="Trip settings"
                onClick={() => setSettingsOpen(o => !o)}
              >⚙</button>
            </div>
            <span className="scrapbook-sub">{places.length === 0
              ? 'No places yet — search to start collecting'
              : `${places.length} place${places.length === 1 ? '' : 's'}`}</span>
          </div>

          <div className="scrapbook-body">
            {settingsOpen && <TripSettings />}
            <DayRail />

            {unassigned.length > 0 && (
              <>
                {days.length > 0 && <div className="scrapbook-section">Unassigned</div>}
                <ul className="scrapbook-list">
                  {unassigned.map(p => (
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
                      {days.length > 0 && (
                        <select
                          className="scrapbook-day-pick"
                          aria-label={`Assign ${p.name} to a day`}
                          value=""
                          onChange={e => dispatch(assignStop({ placeId: p.id, dayId: e.target.value }))}
                        >
                          <option value="">+day</option>
                          {days.map((d, i) => (
                            <option key={d.id} value={d.id}>{i + 1} · {dayLabel(d.date)}</option>
                          ))}
                        </select>
                      )}
                      <button
                        className="scrapbook-remove"
                        aria-label={`Remove ${p.name}`}
                        onClick={() => dispatch(removePlace(p.id))}
                      >×</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>
      )}
    </>
  )
}
