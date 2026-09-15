import { useQueries, useQuery } from "@tanstack/react-query";
import { scopeApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import { normalizePlanRun, mergeNormalizedPlanRuns } from "@/shared/api/normalize";
import { useRoutingPlanSettled } from "@/shared/api/hooks/useSeRoutingPlan";
import type { DateSelection, RoutingPlanChoice, ScopePathSegment } from "@/shared/types/scope";
import { dateSelectionToQueryParam } from "@/shared/types/scope";
import { useMemo } from "react";

// Every scope GET generates and returns the plan synchronously in one request/response
// (services.generate_plan_for_scope) - there is no async "still generating" state to
// poll for, so no refetchInterval here. A large scope (e.g. a State with 100+ SEs) can
// just mean the underlying HTTP request takes a while; the query's own isLoading covers
// that. Status is a post-hoc approval marker, not a progress signal - see StatusBanner.
//
// routingPlan (added 2026-08-31) is threaded through the same way date is: since every
// scope GET regenerates the whole plan from scratch, a passive re-fetch that omitted it
// would silently regenerate back to Plan A server-side even after the user picked Plan B
// via Create/Refresh.
//
// Both hooks stay disabled until useRoutingPlanSettled says the plan they'd send is the
// one that will stick - for an SE that's "the admin-configured plan has loaded and is in
// the store". Firing earlier meant a wasted default-plan generation that then blocked
// the real one on the DB write lock (see useSeRoutingPlan.ts).
export function useScopePlanRun(
  segment: ScopePathSegment,
  scopeValue: string | undefined,
  date: DateSelection,
  routingPlan: RoutingPlanChoice,
  enableRotation: boolean,
) {
  const settled = useRoutingPlanSettled(routingPlan);
  return useQuery({
    queryKey: queryKeys.scope(segment, scopeValue ?? "", date, routingPlan, enableRotation),
    queryFn: () =>
      scopeApi.get(segment, scopeValue!, {
        date: dateSelectionToQueryParam(date),
        routing_plan: routingPlan,
        rotation: enableRotation,
      }),
    enabled: !!scopeValue && settled,
    select: normalizePlanRun,
  });
}

// Multi-select fan-out (§7): fire one GET per selected scope value in parallel and
// merge client-side via the indexed normalization pattern (§17), not array concat.
export function useMultiScopePlanRuns(
  segment: ScopePathSegment,
  scopeValues: string[],
  date: DateSelection,
  routingPlan: RoutingPlanChoice,
  enableRotation: boolean,
) {
  const settled = useRoutingPlanSettled(routingPlan);
  const results = useQueries({
    queries: scopeValues.map((scopeValue) => ({
      queryKey: queryKeys.scope(segment, scopeValue, date, routingPlan, enableRotation),
      queryFn: () =>
        scopeApi.get(segment, scopeValue, {
          date: dateSelectionToQueryParam(date),
          routing_plan: routingPlan,
          rotation: enableRotation,
        }),
      enabled: settled,
      select: normalizePlanRun,
    })),
  });

  const merged = useMemo(() => {
    const successful = results
      .map((r) => r.data)
      .filter((d): d is NonNullable<typeof d> => !!d);
    return mergeNormalizedPlanRuns(successful);
  }, [results]);

  const perScope = scopeValues.map((scopeValue, i) => ({
    scopeValue,
    data: results[i]?.data,
    isLoading: results[i]?.isLoading ?? false,
    isError: results[i]?.isError ?? false,
  }));

  return {
    merged,
    perScope,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    errors: results.map((r) => r.error).filter(Boolean),
    results,
  };
}
