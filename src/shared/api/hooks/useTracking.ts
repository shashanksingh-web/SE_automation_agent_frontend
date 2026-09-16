import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trackingApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";

// ~1.5s server-side over a week of runs - cheap enough to refetch on focus, but not
// something to hammer: keep it fresh for a minute rather than refetching on every
// remount while the admin flips between tiers.
export function useTracking(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.tracking(from, to),
    queryFn: () => trackingApi.get(from, to),
    staleTime: 60_000,
    // A half-typed custom range (from after to) is a 400 from the server, not a retry case.
    retry: false,
  });
}

// "Reconcile now" - after it lands, every tracking window is stale (outcomes changed
// for past dates in all of them), so the whole admin-tracking family is invalidated.
export function useReconcileOutcomes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => trackingApi.reconcile(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-tracking"] }),
  });
}
