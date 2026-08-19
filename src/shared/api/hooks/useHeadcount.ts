import { useQuery } from "@tanstack/react-query";
import { headcountApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";

// §12 - primary data source for the Overall view. list=true also feeds the
// global person search; prefer directory/ses/ (useSEs) for scoped SE pickers instead.
export function useHeadcount(list: boolean) {
  return useQuery({
    queryKey: queryKeys.headcount(list),
    queryFn: () => headcountApi.get({ list }),
  });
}
