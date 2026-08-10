import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useSuggest } from '../search/useSuggest'
import { retrieve } from '../search/searchBoxApi'
import { setTripDates, addLodging, updateLodging, removeLodging, setTravelMode } from './tripSlice'
import { setIsochroneVisible } from '../planner/isochroneSlice'
import { materializeDays } from './days'
import type { TravelMode } from '../../shared/types/trip'

const MODES: { value: TravelMode; label: string }[] = [
  { value: 'walking', label: '🚶 Walk' },
  { value: 'driving', label: '🚗 Drive' },
]

// Trip settings section (opens from the scrapbook header): the trip's date
// range and its lodgings. Both are optional until the traveler has them —
// days materialize the moment start and end both exist.
export function TripSettings() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector(s => s.trip.active)
  const isochroneOn = useAppSelector(s => s.isochrone.visible)

  const [start, setStart] = useState(trip?.startDate ?? '')
  const [end, setEnd] = useState(trip?.endDate ?? '')
  const [orphanCount, setOrphanCount] = useState<number | null>(null)

  const [hotelQuery, setHotelQuery] = useState('')
  const [hotel, setHotel] = useState<{ name: string; coord: [number, number] } | null>(null)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const { results, sessionToken, resetSession, clear } = useSuggest(
    hotel ? '' : hotelQuery,
    { proximity: trip?.destination.center, types: 'poi,address' },
  )

  if (!trip) return null

  const datesChanged = start !== (trip.startDate ?? '') || end !== (trip.endDate ?? '')

  function applyDates() {
    if (!trip) return
    // Shrinking the range strands stops — count them and confirm first
    // (PROJECT_PLAN.md §4: shrink = orphan back to the scrapbook).
    const { orphanedStopIds } = materializeDays(trip.days, start || undefined, end || undefined, trip.lodgings)
    if (orphanedStopIds.length > 0 && orphanCount === null) {
      setOrphanCount(orphanedStopIds.length)
      return
    }
    setOrphanCount(null)
    dispatch(setTripDates({ startDate: start || undefined, endDate: end || undefined }))
  }

  async function pickHotel(mapboxId: string) {
    const place = await retrieve(mapboxId, sessionToken())
    resetSession()
    clear()
    if (!place) return
    setHotel({ name: place.name, coord: place.coord })
    setCheckIn(c => c || trip?.startDate || '')
    setCheckOut(c => c || trip?.endDate || '')
  }

  function saveHotel() {
    if (!hotel || !checkIn || !checkOut) return
    dispatch(addLodging({ name: hotel.name, coord: hotel.coord, checkIn, checkOut }))
    setHotel(null)
    setHotelQuery('')
    setCheckIn('')
    setCheckOut('')
  }

  return (
    <div className="trip-settings">
      <div className="trip-settings-group">
        <span className="trip-settings-label">Dates</span>
        <div className="trip-settings-dates">
          <input
            className="junro-input trip-settings-date"
            type="date"
            value={start}
            onChange={e => { setStart(e.target.value); setOrphanCount(null) }}
          />
          <span className="trip-settings-dash">→</span>
          <input
            className="junro-input trip-settings-date"
            type="date"
            value={end}
            onChange={e => { setEnd(e.target.value); setOrphanCount(null) }}
          />
        </div>
        {orphanCount !== null && (
          <div className="trip-settings-warn">
            {orphanCount} assigned {orphanCount === 1 ? 'place goes' : 'places go'} back to the
            scrapbook. Apply anyway?
          </div>
        )}
        {datesChanged && (
          <button className="junro-primary trip-settings-apply" onClick={applyDates}>
            {orphanCount !== null ? 'Yes, apply' : 'Apply dates'}
          </button>
        )}
      </div>

      <div className="trip-settings-group">
        <span className="trip-settings-label">Getting around</span>
        <div className="add-place-cats">
          {MODES.map(m => (
            <button
              key={m.value}
              className={`add-place-cat${trip.prefs.travelMode === m.value ? ' active' : ''}`}
              onClick={() => dispatch(setTravelMode(m.value))}
            >{m.label}</button>
          ))}
        </div>
      </div>

      {trip.lodgings.length > 0 && (
        <div className="trip-settings-group">
          <span className="trip-settings-label">Reachability</span>
          <button
            className={`add-place-cat${isochroneOn ? ' active' : ''}`}
            onClick={() => dispatch(setIsochroneVisible(!isochroneOn))}
          >🥾 Walk reach from hotel (15 · 30 · 45 min)</button>
        </div>
      )}

      <div className="trip-settings-group">
        <span className="trip-settings-label">Lodging</span>
        {trip.lodgings.map(l => (
          <div key={l.id} className="trip-settings-lodging">
            <div className="trip-settings-lodging-head">
              <span className="trip-settings-lodging-name">{l.name}</span>
              <button
                className="trip-settings-remove"
                aria-label={`Remove ${l.name}`}
                onClick={() => dispatch(removeLodging(l.id))}
              >×</button>
            </div>
            <div className="trip-settings-dates">
              <input
                className="junro-input trip-settings-date"
                type="date"
                value={l.checkIn}
                onChange={e => dispatch(updateLodging({ id: l.id, patch: { checkIn: e.target.value } }))}
              />
              <span className="trip-settings-dash">→</span>
              <input
                className="junro-input trip-settings-date"
                type="date"
                value={l.checkOut}
                onChange={e => dispatch(updateLodging({ id: l.id, patch: { checkOut: e.target.value } }))}
              />
            </div>
          </div>
        ))}

        {!hotel && (
          <div className="trip-settings-hotel-search">
            <input
              className="junro-input"
              placeholder="Add a hotel…"
              value={hotelQuery}
              onChange={e => setHotelQuery(e.target.value)}
            />
            {results.length > 0 && (
              <ul className="junro-suggestions">
                {results.map(r => (
                  <li key={r.mapboxId}>
                    <button onClick={() => void pickHotel(r.mapboxId)}>
                      <span className="junro-suggestion-name">{r.name}</span>
                      <span className="junro-suggestion-sub">{r.placeFormatted}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hotel && (
          <div className="trip-settings-lodging">
            <div className="trip-settings-lodging-head">
              <span className="trip-settings-lodging-name">{hotel.name}</span>
              <button className="trip-settings-remove" onClick={() => setHotel(null)}>×</button>
            </div>
            <div className="trip-settings-dates">
              <input
                className="junro-input trip-settings-date"
                type="date"
                value={checkIn}
                onChange={e => setCheckIn(e.target.value)}
              />
              <span className="trip-settings-dash">→</span>
              <input
                className="junro-input trip-settings-date"
                type="date"
                value={checkOut}
                onChange={e => setCheckOut(e.target.value)}
              />
            </div>
            <button
              className="junro-primary trip-settings-apply"
              disabled={!checkIn || !checkOut}
              onClick={saveHotel}
            >Save hotel</button>
          </div>
        )}
      </div>
    </div>
  )
}
