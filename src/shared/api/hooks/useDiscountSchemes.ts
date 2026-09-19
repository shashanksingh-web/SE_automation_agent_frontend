import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { discountSchemesApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";

// Live Discount Service status (Admin > Discount Schemes). The backend already caches
// the live pull for an hour, so no client-side staleTime games - a plain query, and an
// explicit "Refresh" that asks the backend for a guaranteed-live pull and writes the
// answer straight into this query's cache (same pattern as useUpdateAdminConfig).
export function useDiscountSchemes() {
  return useQuery({
    queryKey: queryKeys.discountSchemes(),
    queryFn: () => discountSchemesApi.get(false),
  });
}

export function useRefreshDiscountSchemes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => discountSchemesApi.get(true),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.discountSchemes(), data);
    },
  });
}
