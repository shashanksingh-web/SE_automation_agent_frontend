import { useQueries, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";
import { scopeApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import { normalizePlanRun, mergeNormalizedPlanRuns } from "@/shared/api/normalize";
import type { DateSelection, ScopePathSegment } from "@/shared/types/scope";
import { dateSelectionToQueryParam } from "@/shared/types/scope";
import type { PlanRunResponse } from "@/shared/types/planRun";
import { useMemo } from "react";

// A scope fetch READS the latest generated plan (GET, 2026-09-17) - it never generates.
// Until then every fetch was a full plan generation (services.generate_plan_for_scope)
// and each view load, date switch or window focus rebuilt the plan from scratch;
// generation is now only the explicit Create / Refresh (useTuffFanOutCreate) or a
// backend run, after which useTuff's onSuccess invalidates ["scope"] and this re-reads.
// That also retires the routing-plan gating this hook used to carry: reading can't
// generate with the wrong plan, and Plan A/B/C only applies when generating.
//
// "Nothing generated yet" is a 404 (code NO_PLAN) and is data, not an error: the query
// resolves to null so the view can render an empty state with the Create / Refresh
// button instead of a red failure banner.
async function readScope(segment: ScopePathSegment, scopeValue: string, date: DateSelection): Promise<PlanRunResponse | null> {
  try {
    return await scopeApi.get(segment, scopeValue, { date: dateSelectionToQueryParam(date) });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

const selectNormalized = (raw: PlanRunResponse | null) => (raw ? normalizePlanRun(raw) : null);

export function useScopePlanRun(segment: ScopePathSegment, scopeValue: string | undefined, date: DateSelection) {
  return useQuery({
    queryKey: queryKeys.scope(segment, scopeValue ?? "", date),
    queryFn: () => readScope(segment, scopeValue!, date),
    enabled: !!scopeValue,
    select: selectNormalized,
  });
}

// Multi-select fan-out (§7): one GET per selected scope value in parallel, merged
// client-side via the indexed normalization pattern (§17), not array concat.
export function useMultiScopePlanRuns(segment: ScopePathSegment, scopeValues: string[], date: DateSelection) {
  const results = useQueries({
    queries: scopeValues.map((scopeValue) => ({
      queryKey: queryKeys.scope(segment, scopeValue, date),
      queryFn: () => readScope(segment, scopeValue, date),
      select: selectNormalized,
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
    data: results[i]?.data ?? null,
    isLoading: results[i]?.isLoading ?? false,
    isError: results[i]?.isError ?? false,
    // Fetched fine, nothing generated for this scope/date yet.
    isEmpty: !!results[i]?.isSuccess && results[i]?.data == null,
  }));

  return {
    merged,
    perScope,
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
    allEmpty: perScope.length > 0 && perScope.every((p) => p.isEmpty),
    errors: results.map((r) => r.error).filter(Boolean),
    results,
  };
}
