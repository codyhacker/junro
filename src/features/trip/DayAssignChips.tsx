import type { CSSProperties } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { assignStop } from './tripSlice'
import { selectDays } from './selectors'
import { dayRgbAt } from '../../shared/constants/dayColors'

// Quick day-assignment for a place — one chip per day (tinted in that day's
// color) plus "Unassigned", so assigning is a single click instead of a
// dropdown step. Shared (not PlacePanel-local) because the Unscheduled
// section in DayRail.tsx reuses it for quick-assignment.
export function DayAssignChips({
  placeId,
  assignedDayId,
}: {
  placeId: string
  assignedDayId: string | null
}) {
  const dispatch = useAppDispatch()
  const days = useAppSelector(selectDays)
  const uiMode = useAppSelector((s) => s.mapStyle.uiMode)

  return (
    <div className="day-assign-chips" role="group" aria-label="Assign to a day">
      <button
        className={`day-assign-chip${assignedDayId === null ? ' active' : ''}`}
        aria-pressed={assignedDayId === null}
        onClick={() => dispatch(assignStop({ placeId, dayId: null }))}
      >
        Unassigned
      </button>
      {days.map((d, i) => (
        <button
          key={d.id}
          className={`day-assign-chip${assignedDayId === d.id ? ' active' : ''}`}
          style={{ '--chip-rgb': dayRgbAt(i, uiMode) } as CSSProperties}
          aria-pressed={assignedDayId === d.id}
          onClick={() => dispatch(assignStop({ placeId, dayId: d.id }))}
        >
          Day {i + 1}
        </button>
      ))}
    </div>
  )
}
