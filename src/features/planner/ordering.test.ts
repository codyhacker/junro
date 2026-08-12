import { describe, it, expect } from 'vitest'
import { orderStops, tourCost } from './ordering'

// Full Euclidean matrix over [depot, ...points]; index 0 is the depot.
function euclidMatrix(points: [number, number][]): number[][] {
  return points.map((a) => points.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1])))
}

describe('orderStops', () => {
  it('never returns a longer loop than the naive input order (2-opt verify)', () => {
    // depot at origin; stops deliberately labeled out of travel order so the
    // identity tour 1→2→3 zig-zags.
    const matrix = euclidMatrix([
      [0, 0], // 0 depot
      [10, 0], // 1 far
      [1, 0], // 2 near
      [2, 0], // 3 mid
    ])
    const naive = [1, 2, 3]
    const order = orderStops({ matrix })
    expect(tourCost(matrix, order)).toBeLessThanOrEqual(tourCost(matrix, naive))
    // The optimal loop visits near→mid→far: depot,2,3,1.
    expect(order).toEqual([2, 3, 1])
  })

  it('honors fixedTime anchors in clock order even when slower', () => {
    // Geometry wants near→mid→far (2,3,1); but stop 1 is a 09:00 booking and
    // stop 3 a 17:00 booking, so 1 must precede 3 in the visit order.
    const matrix = euclidMatrix([
      [0, 0], // depot
      [10, 0], // 1  09:00
      [1, 0], // 2  free
      [2, 0], // 3  17:00
    ])
    const order = orderStops({ matrix, anchorMinutes: { 1: 9 * 60, 3: 17 * 60 } })
    const posOf = (v: number) => order.indexOf(v)
    expect(posOf(1)).toBeLessThan(posOf(3))
    expect(order).toHaveLength(3)
    expect([...order].sort()).toEqual([1, 2, 3])
  })

  it('handles trivial sizes', () => {
    expect(orderStops({ matrix: [[0]] })).toEqual([])
    expect(
      orderStops({
        matrix: [
          [0, 5],
          [5, 0],
        ],
      }),
    ).toEqual([1])
  })
})
