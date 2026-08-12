import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { setTripDates } from './tripSlice'
import { materializeDays } from './days'
import { DateRangePicker } from './DateRangePicker'
import { LodgingEditor } from './LodgingEditor'

// The Trip tab — configuration, tucked out of the main flow: the date range and
// hotels. Dates live here (off the top); planning reads them. Share/export and
// the reset actions live as icons in the panel header (TripHeaderActions).
export function TripTab() {
  const dispatch = useAppDispatch()
  const trip = useAppSelector((s) => s.trip.active)
  const [start, setStart] = useState(trip?.startDate ?? '')
  const [end, setEnd] = useState(trip?.endDate ?? '')
  const [orphanCount, setOrphanCount] = useState<number | null>(null)

  if (!trip) return null

  // Live-apply on any valid change; only hold to confirm when a shrink would
  // strand assigned stops.
  function commitDates(s: string, e: string, force = false) {
    if (!trip) return
    const startDate = s || undefined
    const endDate = e || undefined
    if (startDate && endDate && endDate < startDate) return
    const { orphanedStopIds } = materializeDays(trip.days, startDate, endDate, trip.lodgings)
    if (orphanedStopIds.length > 0 && !force) {
      setOrphanCount(orphanedStopIds.length)
      return
    }
    setOrphanCount(null)
    dispatch(setTripDates({ startDate, endDate }))
  }

  return (
    <div className="trip-settings">
      <div className="trip-settings-group">
        <span className="trip-settings-label">Dates</span>
        <DateRangePicker
          start={start || undefined}
          end={end || undefined}
          onChange={(s, e) => {
            setStart(s)
            setEnd(e)
            commitDates(s, e)
          }}
        />
        {orphanCount !== null && (
          <>
            <div className="trip-settings-warn">
              {orphanCount} planned {orphanCount === 1 ? 'place goes' : 'places go'} back to Places.
            </div>
            <button
              className="junro-primary trip-settings-apply"
              onClick={() => commitDates(start, end, true)}
            >
              Shorten anyway
            </button>
          </>
        )}
      </div>

      <LodgingEditor />
    </div>
  )
}
