import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { useSuggest } from '../search/useSuggest'
import { retrieve } from '../search/searchBoxApi'
import { addLodging, updateLodging, removeLodging } from './tripSlice'
import { setIsochroneVisible } from '../planner/isochroneSlice'
import { nextIsoDate } from './days'
import { DateRangeField } from './DateRangeField'

// Hotels for the Trip tab. Existing hotels list with a ◎ reach action + date
// range; a ＋ button reveals the search to add another (no static input sitting
// there). Check-in/out stay bound to the trip window.
export function LodgingEditor() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector((s) => s.trip.active)
  const isochroneOn = useAppSelector((s) => s.isochrone.visible)

  const [adding, setAdding] = useState(false)
  const [hotelQuery, setHotelQuery] = useState('')
  const [hotel, setHotel] = useState<{ name: string; coord: [number, number] } | null>(null)
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const { results, sessionToken, resetSession, clear } = useSuggest(hotel ? '' : hotelQuery, {
    proximity: trip?.destination.center,
    types: 'poi,address',
  })

  if (!trip) return null
  const tripStart = trip.startDate
  const tripEnd = trip.endDate
  const checkoutMax = tripEnd ? nextIsoDate(tripEnd) : undefined

  async function pickHotel(mapboxId: string) {
    const place = await retrieve(mapboxId, sessionToken())
    resetSession()
    clear()
    if (!place) return
    setHotel({ name: place.name, coord: place.coord })
    setCheckIn((c) => c || trip?.startDate || '')
    setCheckOut((c) => c || (trip?.endDate ? nextIsoDate(trip.endDate) : ''))
  }

  function saveHotel() {
    if (!hotel || !checkIn || !checkOut) return
    dispatch(addLodging({ name: hotel.name, coord: hotel.coord, checkIn, checkOut }))
    setHotel(null)
    setHotelQuery('')
    setCheckIn('')
    setCheckOut('')
    setAdding(false)
  }

  return (
    <div className="trip-settings-group">
      <span className="trip-settings-label">Hotels</span>

      {trip.lodgings.map((l) => (
        <div key={l.id} className="trip-settings-lodging">
          <div className="trip-settings-lodging-head">
            <span className="trip-settings-lodging-name">{l.name}</span>
            <button
              className={`trip-settings-reach${isochroneOn ? ' active' : ''}`}
              aria-label="Toggle walk reach from this hotel"
              title="Walk reach — 15 · 30 · 45 min"
              onClick={() => dispatch(setIsochroneVisible(!isochroneOn))}
            >
              ◎
            </button>
            <button
              className="trip-settings-remove"
              aria-label={`Remove ${l.name}`}
              onClick={() => dispatch(removeLodging(l.id))}
            >
              ×
            </button>
          </div>
          <DateRangeField
            start={l.checkIn || undefined}
            end={l.checkOut || undefined}
            min={tripStart}
            max={checkoutMax}
            startLabel="Check in"
            endLabel="Check out"
            onChange={(checkIn, checkOut) =>
              dispatch(updateLodging({ id: l.id, patch: { checkIn, checkOut } }))
            }
          />
        </div>
      ))}

      {hotel ? (
        <div className="trip-settings-lodging">
          <div className="trip-settings-lodging-head">
            <span className="trip-settings-lodging-name">{hotel.name}</span>
            <button
              className="trip-settings-remove"
              onClick={() => {
                setHotel(null)
                setAdding(false)
              }}
            >
              ×
            </button>
          </div>
          <DateRangeField
            start={checkIn || undefined}
            end={checkOut || undefined}
            min={tripStart}
            max={checkoutMax}
            startLabel="Check in"
            endLabel="Check out"
            onChange={(s, e) => {
              setCheckIn(s)
              setCheckOut(e)
            }}
          />
          <button
            className="junro-primary trip-settings-apply"
            disabled={!checkIn || !checkOut}
            onClick={saveHotel}
          >
            Save hotel
          </button>
        </div>
      ) : adding ? (
        <div className="trip-settings-hotel-search">
          <input
            className="junro-input"
            placeholder="Search for a hotel…"
            autoFocus
            value={hotelQuery}
            onChange={(e) => setHotelQuery(e.target.value)}
          />
          {results.length > 0 && (
            <ul className="junro-suggestions">
              {results.map((r) => (
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
      ) : (
        <button className="lodging-add" onClick={() => setAdding(true)}>
          ＋ Add a hotel
        </button>
      )}
    </div>
  )
}
