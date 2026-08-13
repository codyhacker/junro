import { useEffect, useRef, useState } from 'react'
import { DateRangePicker, formatIsoShort } from './DateRangePicker'

// One compact trigger — a from/to pair that reads like the old inline inputs —
// that opens `DateRangePicker` in a popover. Mirrors TripHeaderActions' scrim +
// pop idiom. Closing on commit is free: DateRangePicker only calls back on a
// full range, never a half one.
export function DateRangeField({
  start,
  end,
  min,
  max,
  startLabel = 'Start',
  endLabel = 'End',
  onChange,
}: {
  start?: string
  end?: string
  min?: string
  max?: string
  startLabel?: string // placeholder shown when `start` is empty
  endLabel?: string // placeholder shown when `end` is empty
  onChange: (start: string, end: string) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    popRef.current?.scrollIntoView({ block: 'nearest' })
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="date-range-field">
      <button
        ref={triggerRef}
        className={`date-range-trigger${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`date-range-seg${start ? '' : ' empty'}`}>
          {start ? formatIsoShort(start) : startLabel}
        </span>
        <span className="date-range-dash">→</span>
        <span className={`date-range-seg${end ? '' : ' empty'}`}>
          {end ? formatIsoShort(end) : endLabel}
        </span>
      </button>
      {open && <div className="date-range-scrim" onClick={() => setOpen(false)} />}
      {open && (
        <div className="date-range-pop" role="dialog" aria-label="Choose dates" ref={popRef}>
          <DateRangePicker
            start={start}
            end={end}
            min={min}
            max={max}
            onChange={(s, e) => {
              onChange(s, e)
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
