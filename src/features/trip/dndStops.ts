import type { Day } from '../../shared/types/trip'

// Pure reorder math for dragging a stop within / between days on the Plan tab.
// Kept out of the component so the ordering rules are unit-tested and the DnD
// wiring stays thin. The result is a single `setDayStops` payload — that
// reducer claims the id from its old day, so one dispatch handles both a
// same-day reorder and a cross-day move (one undo step).

// Where a dragged stop was dropped: onto another stop (insert before it) or
// onto a day as a whole (append to that day).
export type DropTarget =
  | { kind: 'stop'; placeId: string }
  | { kind: 'day'; dayId: string }

export function computeStopDrop(
  days: Day[],
  draggedId: string,
  target: DropTarget,
): { dayId: string; placeIds: string[] } | null {
  const sourceDay = days.find(d => d.stopIds.includes(draggedId))
  if (!sourceDay) return null

  const destDay =
    target.kind === 'day'
      ? days.find(d => d.id === target.dayId)
      : days.find(d => d.stopIds.includes(target.placeId))
  if (!destDay || destDay.locked) return null
  // Can't drop a stop onto itself.
  if (target.kind === 'stop' && target.placeId === draggedId) return null

  const without = destDay.stopIds.filter(id => id !== draggedId)
  const index =
    target.kind === 'day'
      ? without.length                                   // append to the day
      : Math.max(0, without.indexOf(target.placeId))     // insert before the target stop

  const placeIds = [...without.slice(0, index), draggedId, ...without.slice(index)]

  // No-op: dropped back exactly where it already was.
  if (destDay.id === sourceDay.id && placeIds.join() === destDay.stopIds.join()) return null

  return { dayId: destDay.id, placeIds }
}
