import { useQuery } from "@tanstack/react-query";
import { dcCardApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import { ApiError } from "@/shared/api/client";

// DC Card (Preface) / "Dehaat Center Ko Jaano" - 404 means "no card for this task"
// (Farmer Meeting tasks have no DC to brief on), not a failed request - same contract
// as usePitch.ts.
export function useDCCard(dailyTaskId: number | undefined) {
  const query = useQuery({
    queryKey: queryKeys.dcCard(dailyTaskId ?? -1),
    queryFn: () => dcCardApi.get(dailyTaskId!),
    enabled: !!dailyTaskId,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });

  const noCard = query.isError && query.error instanceof ApiError && query.error.status === 404;
  // Reason: "generation_failed" - a DC-tied task that should have a card but doesn't,
  // distinct from "not_applicable" (Farmer Meeting, expected). See ApiErrorBody.Reason.
  const generationFailed =
    noCard &&
    query.error instanceof ApiError &&
    query.error.body?.Reason === "generation_failed";

  return { ...query, noCard, generationFailed };
}
