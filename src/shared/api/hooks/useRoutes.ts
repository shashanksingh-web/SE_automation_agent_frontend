import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routingApi, runsApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import type { RoutePlanType } from "@/shared/types/routing";
import type { PlanRunResponse } from "@/shared/types/planRun";

// §10 - Plan Drawer data: one card per plan (Priority-Max / Distance-Min / Balanced).
export function useRoutes(
  se: string | undefined,
  planDate: string | undefined,
  planRun?: string,
) {
  return useQuery({
    queryKey: queryKeys.routes(se ?? "", planDate ?? "", planRun),
    queryFn: () => routingApi.list(se!, planDate!, { plan_run: planRun }),
    enabled: !!se && !!planDate,
  });
}

// select_default_route_plan (planning/routing.py) returns a small confirmation object,
// not the updated route list - refetch the list query instead of trying to splice the
// confirmation into its cache (that shape mismatch is what crashed the Plan Drawer with
// "data.plans is not iterable").
//
// Deliberately does NOT invalidate/refetch ["scope"]/["tuff"] here, even though selecting
// a route does re-sync this SE's DailyTask rows server-side. Every plain scope/tuff GET
// regenerates the ENTIRE plan from scratch on every call
// (services.generate_plan_for_scope calls routing.generate_route_plans_for_se per SE) -
// invalidating those queries would trigger a full regeneration that creates a brand-new
// PlanRun with brand-new RoutePlan rows (defaults reset by the algorithm), and
// resolve_route_plan_run always resolves to the *most recent* PlanRun. That new run would
// immediately supersede the one the user just made a selection on, silently reverting it
// - exactly what an earlier version of this hook did.
//
// Instead, to reflect the resync in the main screen's task table without regenerating
// anything: GET /runs/<plan_run_id>/ (plan_run_detail) is a pure read of the SAME already-
// persisted PlanRun - no regeneration - so it safely returns the post-resync task list.
// Patch that into any currently-cached scope/tuff query that's displaying this exact
// PlanRun (matched by PlanRun_ID, not by scope/date, since a ZBM view fans out several
// scope queries that could each be showing it). Best-effort: if this fetch fails, the
// route selection itself already succeeded and the drawer's own refetch above is correct.
export function useSelectRoutePlan(se: string, planDate: string, planRun?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planType: RoutePlanType) =>
      routingApi.select(se, planDate, planType, { plan_run: planRun }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes(se, planDate, planRun) });

      try {
        const planRunId = String(data.plan_run_id);
        const fresh = await runsApi.get(planRunId);
        queryClient.setQueriesData<PlanRunResponse>(
          {
            predicate: (query) => {
              const key = query.queryKey[0];
              if (key !== "scope" && key !== "tuff") return false;
              const cached = query.state.data as PlanRunResponse | undefined;
              return cached != null && String(cached.PlanRun_ID) === planRunId;
            },
          },
          fresh,
        );
      } catch {
        // Best-effort refresh only - see comment above.
      }
    },
  });
}
