import { startAppListening } from '../../app/listenerMiddleware'
import { routeRequested, routeReady, routeFailed, routesDropped } from './plannerSlice'
import { fetchDayRoute, isAbort } from './routingService'
import { selectDayRouteRequests, type DayRouteRequest } from './selectors'

// The seam between the trip document and the Directions service: a trip edit
// changes a day's content hash, this listener notices, and only that day
// refetches (PROJECT_PLAN.md §5.1). The engine is not involved — the route
// reaches the map through the planner slice and selectAugmentationSpec.

export function registerRoutingListeners(): () => void {
  return startAppListening({
    predicate: (_action, currentState, previousState) =>
      selectDayRouteRequests(currentState) !== selectDayRouteRequests(previousState),

    effect: async (_action, api) => {
      const requests = selectDayRouteRequests(api.getState())
      const wanted = new Set(requests.map((r) => r.dayId))

      // Days that vanished or fell below two coordinates keep no route.
      const { dayRoutes, routeStatus } = api.getState().planner
      const dropped = [...new Set([...Object.keys(dayRoutes), ...Object.keys(routeStatus)])].filter(
        (dayId) => !wanted.has(dayId),
      )
      if (dropped.length > 0) api.dispatch(routesDropped(dropped))

      for (const request of requests) {
        const planner = api.getState().planner
        // Already solved, already in flight, or already failed for exactly
        // this content — nothing to do.
        if (planner.dayRoutes[request.dayId]?.hash === request.hash) continue
        if (planner.routeStatus[request.dayId]?.hash === request.hash) continue
        api.dispatch(routeRequested({ dayId: request.dayId, hash: request.hash }))
        void solve(api.dispatch, request)
      }
    },
  })
}

type Dispatch = Parameters<Parameters<typeof startAppListening>[0]['effect']>[1]['dispatch']

async function solve(dispatch: Dispatch, request: DayRouteRequest): Promise<void> {
  try {
    const result = await fetchDayRoute(request.dayId, request.coords, request.mode)
    if (!result) {
      dispatch(routeFailed({ dayId: request.dayId, hash: request.hash }))
      return
    }
    dispatch(
      routeReady({
        dayId: request.dayId,
        hash: request.hash,
        mode: request.mode,
        ...result,
      }),
    )
  } catch (err) {
    // A superseded request already has a newer one in flight — leaving its
    // status alone is the whole point of the abort.
    if (isAbort(err)) return
    dispatch(routeFailed({ dayId: request.dayId, hash: request.hash }))
  }
}
