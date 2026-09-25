import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dcSelectionApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import type { DCSelectionFilterMode, DCSelectionRules, DCSelectionUploadMode } from "@/shared/types/dcSelection";

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
      upload_mode,
      actor,
    }: {
      rules?: DCSelectionRules;
      manual_includes?: string[];
      manual_excludes?: string[];
      upload_mode?: DCSelectionUploadMode;
      actor?: string;
    }) => dcSelectionApi.update({ rules, manual_includes, manual_excludes, upload_mode }, actor),
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
    mutationFn: ({
      file,
      actor,
      uploadMode,
    }: {
      file: File;
      actor?: string;
      uploadMode?: DCSelectionUploadMode;
    }) => dcSelectionApi.uploadSelectedDcs(file, actor, uploadMode),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.dcSelection(), data);
      queryClient.invalidateQueries({ queryKey: ["dc-selection", "search"] });
    },
  });
}

// Live preview of Selected_Count for an unsaved rule edit (explicit user request,
// "reflection of count before save rule") - debounced so a rank-range min/max keystroke
// doesn't fire a request per character. `rules`/`uploadMode` are only passed while the
// panel actually has a pending (unsaved) edit; pass null to disable (see `enabled`
// below) rather than calling this with the already-saved rule, which would just
// duplicate useDCSelection's own Selected_Count for no benefit.
export function useDCSelectionPreview(rules: DCSelectionRules | null, uploadMode: DCSelectionUploadMode) {
  const [debounced, setDebounced] = useState(rules);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(rules), 400);
    return () => clearTimeout(timer);
  }, [rules]);

  return useQuery({
    queryKey: queryKeys.dcSelectionPreview(JSON.stringify(debounced), uploadMode),
    queryFn: () => dcSelectionApi.previewSelection(debounced as DCSelectionRules, uploadMode),
    enabled: debounced !== null,
    // Keeps the last preview number on screen while the debounced request for the next
    // edit is in flight, instead of flashing to a loading state on every keystroke.
    placeholderData: (previous) => previous,
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
