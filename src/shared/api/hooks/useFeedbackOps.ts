import { useQuery } from "@tanstack/react-query";
import { feedbackOpsApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";

// §13 - streaks: chronic-miss flag, surfaced as a warning badge / dedicated panel.
// Server caps at 500 rows by default (worst-first, by Consecutive_Misses) - the query's
// `data` is a PaginatedResult ({data, totalCount, limit, offset}), not a bare array;
// callers use `.data?.data` for rows and `.data?.totalCount` to detect truncation.
export function useStreaks(params?: { se?: string; dc?: string; min_misses?: number }) {
  return useQuery({
    queryKey: queryKeys.streaks(params?.se, params?.dc, params?.min_misses),
    queryFn: () => feedbackOpsApi.streaks(params),
  });
}

// §13 - BO score source. No score field lives in PlanRun/task/route payloads;
// this trailing-30d completion rate is what feeds BO scoring widgets. Both filters
// are optional on the real endpoint (500 rows by default, ordered by SE/objective).
export function useCompletionStats(params: { se?: string; objective?: string }) {
  return useQuery({
    queryKey: queryKeys.completionStats(params.se, params.objective),
    queryFn: () => feedbackOpsApi.completionStats(params),
  });
}

// §13 - admin-only Ops view: which scopes auto-run on cron.
export function useScheduledScopes(params?: { active?: boolean; scope_type?: string }) {
  return useQuery({
    queryKey: queryKeys.scheduledScopes(params?.active, params?.scope_type),
    queryFn: () => feedbackOpsApi.scheduledScopes(params),
  });
}
