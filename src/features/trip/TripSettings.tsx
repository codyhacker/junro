import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useSuggest } from '../search/useSuggest'
import { retrieve } from '../search/searchBoxApi'
import { setTripDates, addLodging, updateLodging, removeLodging, setTravelMode } from './tripSlice'
import { setIsochroneVisible } from '../planner/isochroneSlice'
import { materializeDays, nextIsoDate } from './days'
import { DateRangePicker } from './DateRangePicker'
import type { TravelMode } from '../../shared/types/trip'

// Keep a date within [lo, hi] (either bound optional). Typed input can bypass
// an <input min/max>, so we clamp on change too.
const clampDate = (v: string, lo?: string, hi?: string) =>
  !v ? v : lo && v < lo ? lo : hi && v > hi ? hi : v

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

  // Hotel stays are bound to the trip window: check-in on any trip night
  // [start, end]; check-out the morning after, up to end + 1.
  const tripStart = trip.startDate
  const tripEnd = trip.endDate
  const checkoutMax = tripEnd ? nextIsoDate(tripEnd) : undefined

  // Live-apply dates: commit on any valid change, with no "Apply" button. The
  // only time we hold is when a change would strand stops — then we ask once
  // (PROJECT_PLAN.md §4: shrink = orphan back to the scrapbook).
  function commitDates(s: string, e: string, force = false) {
    if (!trip) return
    const startDate = s || undefined
    const endDate = e || undefined
    if (startDate && endDate && endDate < startDate) return   // mid-edit, wait
    const { orphanedStopIds } = materializeDays(trip.days, startDate, endDate, trip.lodgings)
    if (orphanedStopIds.length > 0 && !force) { setOrphanCount(orphanedStopIds.length); return }
    setOrphanCount(null)
    dispatch(setTripDates({ startDate, endDate }))
  }

  async function pickHotel(mapboxId: string) {
    const place = await retrieve(mapboxId, sessionToken())
    resetSession()
    clear()
    if (!place) return
    setHotel({ name: place.name, coord: place.coord })
    // Default to covering the whole trip: check in on the first day, out the
    // morning after the last night (end + 1) so no night is left unhoused.
    setCheckIn(c => c || trip?.startDate || '')
    setCheckOut(c => c || (trip?.endDate ? nextIsoDate(trip.endDate) : ''))
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
        <DateRangePicker
          start={start || undefined}
          end={end || undefined}
          onChange={(s, e) => { setStart(s); setEnd(e); commitDates(s, e) }}
        />
        {orphanCount !== null && (
          <>
            <div className="trip-settings-warn">
              {orphanCount} assigned {orphanCount === 1 ? 'place goes' : 'places go'} back to the
              scrapbook.
            </div>
            <button className="junro-primary trip-settings-apply" onClick={() => commitDates(start, end, true)}>
              Shorten anyway
            </button>
          </>
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

      <div className="trip-settings-group">
        <span className="trip-settings-label">Lodging</span>
        {trip.lodgings.map(l => (
          <div key={l.id} className="trip-settings-lodging">
            <div className="trip-settings-lodging-head">
              <span className="trip-settings-lodging-name">{l.name}</span>
              <button
                className={`trip-settings-reach${isochroneOn ? ' active' : ''}`}
                aria-label="Toggle walk reach from this hotel"
                title="Walk reach — 15 · 30 · 45 min"
                onClick={() => dispatch(setIsochroneVisible(!isochroneOn))}
              >◎</button>
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
                min={tripStart} max={tripEnd}
                value={l.checkIn}
                onChange={e => dispatch(updateLodging({ id: l.id, patch: { checkIn: clampDate(e.target.value, tripStart, tripEnd) } }))}
              />
              <span className="trip-settings-dash">→</span>
              <input
                className="junro-input trip-settings-date"
                type="date"
                min={l.checkIn || tripStart} max={checkoutMax}
                value={l.checkOut}
                onChange={e => dispatch(updateLodging({ id: l.id, patch: { checkOut: clampDate(e.target.value, l.checkIn || tripStart, checkoutMax) } }))}
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
                min={tripStart} max={tripEnd}
                value={checkIn}
                onChange={e => setCheckIn(clampDate(e.target.value, tripStart, tripEnd))}
              />
              <span className="trip-settings-dash">→</span>
              <input
                className="junro-input trip-settings-date"
                type="date"
                min={checkIn || tripStart} max={checkoutMax}
                value={checkOut}
                onChange={e => setCheckOut(clampDate(e.target.value, checkIn || tripStart, checkoutMax))}
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
