import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dcSelectionApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import type { DCSelectionFilterMode, DCSelectionRules } from "@/shared/types/dcSelection";

// DC Selection (added 2026-09-08) - same "write result straight into cache" pattern as
// useAdminConfig: a save/upload reflects the new Selected_Count/Configured instantly
// with no extra round trip.
export function useDCSelection() {
  return useQuery({
    queryKey: queryKeys.dcSelection(),
    queryFn: () => dcSelectionApi.getState(),
  });
}

export function useUpdateDCSelection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      rules,
      manual_includes,
      manual_excludes,
      actor,
    }: {
      rules?: DCSelectionRules;
      manual_includes?: string[];
      manual_excludes?: string[];
      actor?: string;
    }) => dcSelectionApi.update({ rules, manual_includes, manual_excludes }, actor),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.dcSelection(), data);
      // A rule/manual-list change can flip in_selection for any row currently shown by
      // the search panel - invalidate rather than try to patch it in place.
      queryClient.invalidateQueries({ queryKey: ["dc-selection", "search"] });
    },
  });
}

export function useUploadDCSelectionRankCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, actor }: { file: File; actor?: string }) =>
      dcSelectionApi.uploadRankCsv(file, actor),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.dcSelection(), data);
      // Rank/Cohort per DC may have changed - the universe search results are stale too.
      queryClient.invalidateQueries({ queryKey: ["dc-selection", "search"] });
    },
  });
}

export function useUploadDCSelectionSelectedDcs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, actor }: { file: File; actor?: string }) =>
      dcSelectionApi.uploadSelectedDcs(file, actor),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.dcSelection(), data);
      queryClient.invalidateQueries({ queryKey: ["dc-selection", "search"] });
    },
  });
}

export function useDCSelectionSearch(q: string, filterMode: DCSelectionFilterMode, offset: number, limit = 25) {
  return useQuery({
    queryKey: queryKeys.dcSelectionSearch(q, filterMode, offset),
    queryFn: () => dcSelectionApi.search({ q, filter_mode: filterMode, offset, limit }),
    // Keeps the previous page's rows on screen while a new search/page loads instead of
    // flashing to a loading state - this panel is browsed interactively (typing a search
    // term, paging through 10k+ DCs), not a one-shot fetch.
    placeholderData: (previous) => previous,
  });
}
