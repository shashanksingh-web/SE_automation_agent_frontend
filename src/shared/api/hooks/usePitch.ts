import { useQuery } from "@tanstack/react-query";
import { pitchingApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import { ApiError } from "@/shared/api/client";

// §11 - 404 means "no pitch for this task" (e.g. Farmer Meeting), not a failed request.
// Callers should check `noPitch` and render an empty state, never an error toast.
export function usePitch(dailyTaskId: number | undefined) {
  const query = useQuery({
    queryKey: queryKeys.pitch(dailyTaskId ?? -1),
    queryFn: () => pitchingApi.get(dailyTaskId!),
    enabled: !!dailyTaskId,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });

  const noPitch = query.isError && query.error instanceof ApiError && query.error.status === 404;
  // Reason: "generation_failed" - a DC-tied task that should have a pitch but doesn't,
  // distinct from "not_applicable" (Farmer Meeting, expected). See ApiErrorBody.Reason.
  const generationFailed =
    noPitch &&
    query.error instanceof ApiError &&
    query.error.body?.Reason === "generation_failed";

  return { ...query, noPitch, generationFailed };
}

// Recommended_Task_Type values that never carry a pitch - don't render the
// pitch-expand affordance for these task types at all (§11).
export function taskTypeHasNoPitch(recommendedTaskType: string | null | undefined): boolean {
  return (recommendedTaskType ?? "").toLowerCase().includes("farmer meeting");
}
