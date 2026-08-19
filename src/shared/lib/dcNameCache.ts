// Session-lifetime DC_ID -> DC_Name cache. Exists because resync_daily_tasks_from_selected_plan
// (planning/routing.py) rebuilds a task's DailyTask row from its RoutePlan stop after a
// route selection, and RouteStop only carries dc_id/distance/purpose - not a name, so
// DC_Name (and every other richer field) comes back null on a resynced task even though
// we already saw the real name in an earlier, fuller fetch of the same DC this session.
// A plain module-level Map, not React state: it's a passive memoization layer, not
// something that should trigger re-renders on its own - components read it inline.
const cache = new Map<string, string>();

export function rememberDCName(dcId: string, dcName: string | null | undefined): void {
  if (dcName) cache.set(dcId, dcName);
}

export function getCachedDCName(dcId: string): string | undefined {
  return cache.get(dcId);
}
