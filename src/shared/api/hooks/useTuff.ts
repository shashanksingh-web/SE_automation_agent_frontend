import { useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizationApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import type { DateSelection } from "@/shared/types/scope";
import { dateSelectionToQueryParam } from "@/shared/types/scope";

type TuffScopeType = "SE" | "ABM" | "RBM" | "NODE" | "BLOCK" | "DISTRICT" | "STATE";

// Create/Refresh action (§9, §15) - the combined endpoint that runs normalization
// and generates/returns the plan in one call. Works directly off whatever scope is
// selected (a State works exactly like an SE: no forced drill-down).
export function useTuffCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scopeType,
      scopeValue,
      date,
    }: {
      scopeType: TuffScopeType;
      scopeValue: string;
      date: DateSelection;
    }) =>
      normalizationApi.tuff(scopeType, scopeValue, {
        date: dateSelectionToQueryParam(date),
        force_normalization: true,
      }),
    onSuccess: (_data, variables) => {
      // Invalidate the matching plain scope query too - Create/Refresh should update
      // both entry points to the same underlying PlanRun.
      queryClient.invalidateQueries({
        queryKey: queryKeys.tuff(variables.scopeType, variables.scopeValue, variables.date),
      });
      queryClient.invalidateQueries({ queryKey: ["scope"] });
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

// Fan out /tuff/STATE/<name>/ once per ZBM-covered state and merge (§7, §15) -
// used for the ZBM/State Head view and multi-select State creation.
export function useTuffFanOutCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scopeType,
      scopeValues,
      date,
    }: {
      scopeType: TuffScopeType;
      scopeValues: string[];
      date: DateSelection;
    }) => {
      const results = await Promise.allSettled(
        scopeValues.map((value) =>
          normalizationApi.tuff(scopeType, value, {
            date: dateSelectionToQueryParam(date),
            force_normalization: true,
          }),
        ),
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scope"] });
      queryClient.invalidateQueries({ queryKey: ["tuff"] });
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}
