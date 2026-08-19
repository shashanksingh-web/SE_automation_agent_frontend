import { useQueries, useQuery } from "@tanstack/react-query";
import { scopeApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import { normalizePlanRun, mergeNormalizedPlanRuns } from "@/shared/api/normalize";
import type { DateSelection, ScopePathSegment } from "@/shared/types/scope";
import { dateSelectionToQueryParam } from "@/shared/types/scope";
import { useMemo } from "react";

// Every scope GET generates and returns the plan synchronously in one request/response
// (services.generate_plan_for_scope) - there is no async "still generating" state to
// poll for, so no refetchInterval here. A large scope (e.g. a State with 100+ SEs) can
// just mean the underlying HTTP request takes a while; the query's own isLoading covers
// that. Status is a post-hoc approval marker, not a progress signal - see StatusBanner.
export function useScopePlanRun(
  segment: ScopePathSegment,
  scopeValue: string | undefined,
  date: DateSelection,
) {
  return useQuery({
    queryKey: queryKeys.scope(segment, scopeValue ?? "", date),
    queryFn: () =>
      scopeApi.get(segment, scopeValue!, { date: dateSelectionToQueryParam(date) }),
    enabled: !!scopeValue,
    select: normalizePlanRun,
  });
}

// Multi-select fan-out (§7): fire one GET per selected scope value in parallel and
// merge client-side via the indexed normalization pattern (§17), not array concat.
export function useMultiScopePlanRuns(
  segment: ScopePathSegment,
  scopeValues: string[],
  date: DateSelection,
) {
  const results = useQueries({
    queries: scopeValues.map((scopeValue) => ({
      queryKey: queryKeys.scope(segment, scopeValue, date),
      queryFn: () =>
        scopeApi.get(segment, scopeValue, { date: dateSelectionToQueryParam(date) }),
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
