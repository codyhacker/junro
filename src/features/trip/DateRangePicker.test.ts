import { describe, it, expect } from 'vitest'
import { formatIsoShort } from './DateRangePicker'

describe('formatIsoShort', () => {
  it('formats a mid-month date as "Mon D"', () => {
    expect(formatIsoShort('2026-08-12')).toBe('Aug 12')
  })

  it('does not drop a leading zero on the day', () => {
    expect(formatIsoShort('2026-01-05')).toBe('Jan 5')
  })

  it('formats December correctly (no month index off-by-one)', () => {
    expect(formatIsoShort('2026-12-31')).toBe('Dec 31')
  })

  it('is stable across timezones (string-sliced, never Date-parsed)', () => {
    // A `new Date(iso)`-based formatter renders a day early in negative-offset
    // zones because 'YYYY-MM-DD' parses as UTC midnight. String-slicing has
    // no such failure mode — this is the property the export exists to lock in.
    expect(formatIsoShort('2026-03-01')).toBe('Mar 1')
  })
})
