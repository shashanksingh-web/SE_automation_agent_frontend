import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pitchDcCardApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";

// Backs the Pitch/DC Card panels' "Generate"/"Retry generation" CTA (usePitch/useDCCard's
// noPitch/noCard empty states). One backend call regenerates both, so one hook covers
// both panels rather than duplicating it per-panel - they're never open simultaneously
// (single-drawer-open convention), so no duplicate-call risk between the two mounts.
export function useGeneratePitchAndDCCard(dailyTaskId: number | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => pitchDcCardApi.generate(dailyTaskId!),
    onSuccess: () => {
      if (dailyTaskId == null) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.pitch(dailyTaskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dcCard(dailyTaskId) });
    },
  });
}
