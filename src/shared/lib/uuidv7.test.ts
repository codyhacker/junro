import { describe, it, expect, vi, afterEach } from 'vitest'
import { uuidv7 } from './uuidv7'

afterEach(() => vi.restoreAllMocks())

describe('uuidv7', () => {
  it('produces RFC-4122 shaped v7 ids', () => {
    const id = uuidv7()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('is unique across rapid generation', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()))
    expect(ids.size).toBe(1000)
  })

  it('sorts by generation time (timestamp occupies the high bits)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000)
    const earlier = uuidv7()
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000_000_000)
    const later = uuidv7()
    expect(earlier < later).toBe(true)
  })
})
