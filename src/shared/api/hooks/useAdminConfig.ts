import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";

// Admin Control Panel (added 2026-09-07) - no polling/staleTime override needed, this
// changes only when an admin explicitly saves (see useUpdateAdminConfig below, which
// writes the mutation result straight into this same query's cache rather than
// invalidating + refetching, so a save reflects instantly with zero extra round trip).
export function useAdminConfig() {
  return useQuery({
    queryKey: queryKeys.adminConfig(),
    queryFn: () => adminApi.getConfig(),
  });
}

export function useUpdateAdminConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      changes,
      reset,
      actor,
    }: {
      changes: Record<string, number | string>;
      reset?: string[];
      actor?: string;
    }) => adminApi.updateConfig(changes, reset, actor),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.adminConfig(), data);
    },
  });
}
