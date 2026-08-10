// Stage 3 — intra-day stop ordering (PROJECT_PLAN.md §7). Pure: it takes a
// travel-time matrix (from matrixService, or its haversine fallback) and
// returns the visit order, so the whole optimizer is unit-testable with a
// fixed fixture. Index 0 of the matrix is the depot (the day's lodging); the
// tour is depot → stops → depot.
//
// `fixedTime` stops are anchors: their relative order is pinned to the clock,
// so NN/2-opt may only shuffle the free stops around them. We seed with
// cheapest-insertion (anchors first, in time order) and then run 2-opt that
// rejects any move which would reorder the anchored subsequence.

export interface OrderingInput {
  matrix: number[][]                    // (n+1)×(n+1); [0] = depot, [1..n] = stops
  anchorMinutes?: Record<number, number>   // stop index (1..n) → minutes-since-midnight
}

// Total time of a depot → …order… → depot loop.
export function tourCost(matrix: number[][], order: number[]): number {
  if (order.length === 0) return 0
  let cost = matrix[0][order[0]]
  for (let i = 0; i < order.length - 1; i++) cost += matrix[order[i]][order[i + 1]]
  cost += matrix[order[order.length - 1]][0]
  return cost
}

function anchoredInOrder(order: number[], anchorMinutes: Record<number, number>): boolean {
  const seen = order.filter(i => i in anchorMinutes)
  for (let k = 1; k < seen.length; k++) {
    if (anchorMinutes[seen[k]] < anchorMinutes[seen[k - 1]]) return false
  }
  return true
}

// Insert a free stop at the position that adds the least travel, respecting a
// predicate so anchors stay in order.
function cheapestInsert(
  matrix: number[][],
  order: number[],
  stop: number,
  ok: (candidate: number[]) => boolean,
): number[] {
  let best: number[] | null = null
  let bestCost = Infinity
  for (let pos = 0; pos <= order.length; pos++) {
    const candidate = [...order.slice(0, pos), stop, ...order.slice(pos)]
    if (!ok(candidate)) continue
    const c = tourCost(matrix, candidate)
    if (c < bestCost) { bestCost = c; best = candidate }
  }
  return best ?? [...order, stop]
}

export function orderStops({ matrix, anchorMinutes = {} }: OrderingInput): number[] {
  const n = matrix.length - 1
  if (n <= 1) return n === 1 ? [1] : []

  const stops = Array.from({ length: n }, (_, i) => i + 1)
  const anchors = stops.filter(i => i in anchorMinutes).sort((a, b) => anchorMinutes[a] - anchorMinutes[b])
  const free = stops.filter(i => !(i in anchorMinutes))

  const keepsAnchors = (order: number[]) => anchoredInOrder(order, anchorMinutes)

  // Seed: anchors in clock order, then cheapest-insert each free stop.
  let order = [...anchors]
  for (const stop of free) order = cheapestInsert(matrix, order, stop, keepsAnchors)

  // 2-opt: reverse order[i..j] whenever it shortens the loop and doesn't
  // scramble the anchored subsequence. n ≤ ~12, so this is microseconds.
  let improved = true
  while (improved) {
    improved = false
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, j + 1).reverse(),
          ...order.slice(j + 1),
        ]
        if (!keepsAnchors(candidate)) continue
        if (tourCost(matrix, candidate) + 1e-9 < tourCost(matrix, order)) {
          order = candidate
          improved = true
        }
      }
    }
  }

  return order
}
