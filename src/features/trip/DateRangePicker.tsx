import { useState } from 'react'

// A single-calendar date-range picker (no dependency). Click a start day, then
// an end day; the range highlights, with a hover preview mid-selection. Emits
// ordered ISO dates only when a full range is chosen, so there's no half-range
// intermediate that would strand stops. Dates are 'YYYY-MM-DD' UTC calendar
// days, matching the rest of the app.

const pad = (n: number) => String(n).padStart(2, '0')
const isoOf = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`
const todayIso = () => {
  const d = new Date()
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate())
}
const firstOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function addMonths(firstIso: string, delta: number): string {
  const [y, m] = firstIso.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return isoOf(d.getUTCFullYear(), d.getUTCMonth(), 1)
}
function monthLabel(firstIso: string): string {
  const [y, m] = firstIso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
function buildWeeks(firstIso: string): (string | null)[][] {
  const [y, m] = firstIso.split('-').map(Number)
  const startWd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (string | null)[] = Array(startWd).fill(null)
  for (let d = 1; d <= days; d++) cells.push(isoOf(y, m - 1, d))
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// Short trigger label — e.g. "Aug 12". String-sliced, never parsed through
// `new Date(iso)` (that's UTC midnight and renders a day early in
// negative-offset zones); the whole app does calendar-day math on strings.
export const formatIsoShort = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(iso.slice(8))}`

export function DateRangePicker({
  start,
  end,
  min,
  max,
  onChange,
}: {
  start?: string
  end?: string
  min?: string // earliest selectable ISO day, inclusive
  max?: string // latest selectable ISO day, inclusive
  onChange: (start: string, end: string) => void
}) {
  const [view, setView] = useState(() => {
    let v = firstOfMonth(start || min || todayIso())
    if (min && v < firstOfMonth(min)) v = firstOfMonth(min)
    if (max && v > firstOfMonth(max)) v = firstOfMonth(max)
    return v
  })
  const [pending, setPending] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const blocked = (iso: string) => (!!min && iso < min) || (!!max && iso > max)

  function pick(iso: string) {
    if (blocked(iso)) return
    if (!pending) {
      setPending(iso)
      return
    }
    const [s, e] = iso < pending ? [iso, pending] : [pending, iso]
    setPending(null)
    setHover(null)
    onChange(s, e)
  }

  // The range to highlight: mid-selection uses pending + hover preview; at rest
  // it's the committed start/end.
  let lo: string | undefined, hi: string | undefined
  if (pending) {
    if (hover) {
      lo = hover < pending ? hover : pending
      hi = hover < pending ? pending : hover
    } else {
      lo = hi = pending
    }
  } else {
    lo = start
    hi = end
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <button
          className="cal-nav"
          aria-label="Previous month"
          disabled={!!min && addMonths(view, -1) < firstOfMonth(min)}
          onClick={() => setView((v) => addMonths(v, -1))}
        >
          ‹
        </button>
        <span className="cal-month">{monthLabel(view)}</span>
        <button
          className="cal-nav"
          aria-label="Next month"
          disabled={!!max && addMonths(view, 1) > firstOfMonth(max)}
          onClick={() => setView((v) => addMonths(v, 1))}
        >
          ›
        </button>
      </div>
      <div className="cal-weekdays">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="cal-grid" onMouseLeave={() => setHover(null)}>
        {buildWeeks(view)
          .flat()
          .map((iso, i) => {
            if (!iso) return <span key={i} className="cal-cell cal-blank" />
            const isLo = iso === lo
            const isHi = iso === hi
            const inRange = lo && hi && iso > lo && iso < hi
            const isBlocked = blocked(iso)
            return (
              <button
                key={i}
                className={`cal-cell${isLo ? ' cal-start' : ''}${isHi ? ' cal-end' : ''}${inRange ? ' cal-inrange' : ''}${iso === todayIso() ? ' cal-today' : ''}`}
                disabled={isBlocked}
                onMouseEnter={() => {
                  if (isBlocked) return
                  if (pending) setHover(iso)
                }}
                onClick={() => pick(iso)}
              >
                {Number(iso.slice(8))}
              </button>
            )
          })}
      </div>
      <div className="cal-hint">
        {pending
          ? 'Pick the end date'
          : start && end
            ? `${start} → ${end}`
            : 'Pick your start & end dates'}
      </div>
    </div>
  )
}
