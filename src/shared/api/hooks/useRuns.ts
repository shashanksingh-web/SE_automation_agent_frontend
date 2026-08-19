import { useQuery } from "@tanstack/react-query";
import { runsApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import { normalizePlanRun } from "@/shared/api/normalize";

// §14 - Runs History list, newest-first, 50 by default (server-capped at 500). ?status=
// pairs with the Status field on PlanRun (§7) to power a filter chip row (Failed /
// Completed / Pending Review). The query's `data` is a PaginatedResult, not a bare
// array - callers use `.data?.data` for rows and `.data?.totalCount` for truncation.
export function useRunsList(params?: {
  scope_type?: string;
  scope_value?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: queryKeys.runs(params?.scope_type, params?.scope_value, params?.status),
    queryFn: () => runsApi.list(params),
  });
}

// Re-opening a previously fetched run should be a cache hit via PlanRun_ID indexing (§17).
export function useRunDetail(planRunId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.run(planRunId ?? ""),
    queryFn: () => runsApi.get(planRunId!),
    enabled: !!planRunId,
    select: normalizePlanRun,
  });
}
