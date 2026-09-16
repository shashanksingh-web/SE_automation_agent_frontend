import { useQuery } from "@tanstack/react-query";
import { trackingApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";

// ~1.5s server-side over a week of runs - cheap enough to refetch on focus, but not
// something to hammer: keep it fresh for a minute rather than refetching on every
// remount while the admin flips between tiers.
export function useTracking(days: number) {
  return useQuery({
    queryKey: queryKeys.tracking(days),
    queryFn: () => trackingApi.get(days),
    staleTime: 60_000,
  });
}
