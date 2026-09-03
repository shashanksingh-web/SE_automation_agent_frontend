import { useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizationApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import type { DateSelection, RoutingPlanChoice } from "@/shared/types/scope";
import { dateSelectionToQueryParam } from "@/shared/types/scope";

type TuffScopeType = "SE" | "ABM" | "RBM" | "NODE" | "BLOCK" | "DISTRICT" | "STATE";

// Create/Refresh action (§9, §15) - the combined endpoint that runs normalization
// and generates/returns the plan in one call. Works directly off whatever scope is
// selected (a State works exactly like an SE: no forced drill-down).
//
// routingPlan (added 2026-08-31): ?routing_plan=A|B, which family of 3 Routing Agent
// models to generate for this PlanRun (planning/views.py _routing_plan_choice_from_get).
// enableRotation (added 2026-09-01): ?rotation=true, Plan B's opt-in Fixed Rotation beat
// zones - a no-op server-side under Plan A, sent through unconditionally anyway since the
// caller (appStore) already keeps it false whenever routingPlan is "A".
export function useTuffCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scopeType,
      scopeValue,
      date,
      routingPlan,
      enableRotation,
    }: {
      scopeType: TuffScopeType;
      scopeValue: string;
      date: DateSelection;
      routingPlan: RoutingPlanChoice;
      enableRotation: boolean;
    }) =>
      normalizationApi.tuff(scopeType, scopeValue, {
        date: dateSelectionToQueryParam(date),
        force_normalization: true,
        routing_plan: routingPlan,
        rotation: enableRotation,
      }),
    onSuccess: (_data, variables) => {
      // Invalidate the matching plain scope query too - Create/Refresh should update
      // both entry points to the same underlying PlanRun.
      queryClient.invalidateQueries({
        queryKey: queryKeys.tuff(
          variables.scopeType,
          variables.scopeValue,
          variables.date,
          variables.routingPlan,
          variables.enableRotation,
        ),
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
      routingPlan,
      enableRotation,
    }: {
      scopeType: TuffScopeType;
      scopeValues: string[];
      date: DateSelection;
      routingPlan: RoutingPlanChoice;
      enableRotation: boolean;
    }) => {
      const results = await Promise.allSettled(
        scopeValues.map((value) =>
          normalizationApi.tuff(scopeType, value, {
            date: dateSelectionToQueryParam(date),
            force_normalization: true,
            routing_plan: routingPlan,
            rotation: enableRotation,
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
