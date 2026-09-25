import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { routingApi, runsApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import type { RoutePlanType } from "@/shared/types/routing";
import type { PlanRunResponse } from "@/shared/types/planRun";

// Shared by every route mutation below that resyncs DailyTask server-side (Accept,
// add-stop, remove-stop - NOT Reject, which deliberately leaves DailyTask untouched,
// see reject_route_plan's own docstring) - same reasoning/pattern useSelectRoutePlan
// already established: refetch the read-only PlanRun (no regeneration) and patch it
// into any cached scope/tuff query showing this exact PlanRun, rather than invalidating
// scope/tuff (which would regenerate a brand-new PlanRun and silently supersede this edit).
async function refreshAfterRouteMutation(queryClient: QueryClient, planRunId: string) {
  try {
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
    // Best-effort refresh only - the mutation itself already succeeded.
  }
}

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
// "data.plans is not iterable"). See refreshAfterRouteMutation above for why the main
// screen's scope/tuff cache is patched via a plain PlanRun re-read rather than
// invalidated (invalidating would trigger a full regeneration that supersedes the
// selection this very call just made).
export function useSelectRoutePlan(se: string, planDate: string, planRun?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planType: RoutePlanType) =>
      routingApi.select(se, planDate, planType, { plan_run: planRun }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes(se, planDate, planRun) });
      await refreshAfterRouteMutation(queryClient, String(data.plan_run_id));
    },
  });
}

// SE's own Accept action (added 2026-09-15, explicit user request). Same cache
// reasoning as useSelectRoutePlan above - it calls the same underlying select, then
// also marks the whole day's PlanRun APPROVED, so the routes-list refetch picks up
// both the newly-selected route AND the new status/reviewed_by/reviewed_at. `actor`
// is the logged-in user's own identity (email/username, see AuthContext) for the
// reviewed_by record - defaults to `se` only as a last resort (the `se` prop is
// sometimes the numeric SE_ID, not a human-readable identity - see PlanDrawer's own
// note on why it needs data.se_name instead for directory/dcs calls).
export function useAcceptRoutePlan(se: string, planDate: string, planRun?: string, actor?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planType: RoutePlanType) =>
      routingApi.accept(se, planDate, planType, { plan_run: planRun, actor: actor || se }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes(se, planDate, planRun) });
      await refreshAfterRouteMutation(queryClient, String(data.plan_run_id));
    },
  });
}

// SE's own Reject action (added 2026-09-15, explicit user request, explicit follow-up
// choice: purely an audit flag - DailyTask is deliberately left untouched, so unlike
// every other mutation here this does NOT call refreshAfterRouteMutation).
export function useRejectRoutePlan(se: string, planDate: string, planRun?: string, actor?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => routingApi.reject(se, planDate, { plan_run: planRun, actor: actor || se }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes(se, planDate, planRun) });
    },
  });
}

// SE adding/removing a DC from their own route (added 2026-09-15, explicit user
// request - "if se wants add the dc in route plan than he will add or wants to delete
// the route he will"). Both resync DailyTask server-side when the edited route is the
// SE's currently-selected one, same cache-refresh reasoning as useAcceptRoutePlan.
export function useAddRouteStop(se: string, planDate: string, planRun?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planType, dcId }: { planType: RoutePlanType; dcId: string }) =>
      routingApi.addStop(se, planDate, planType, dcId, { plan_run: planRun }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes(se, planDate, planRun) });
      await refreshAfterRouteMutation(queryClient, String(data.plan_run_id));
    },
  });
}

export function useRemoveRouteStop(se: string, planDate: string, planRun?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planType, dcId }: { planType: RoutePlanType; dcId: string }) =>
      routingApi.removeStop(se, planDate, planType, dcId, { plan_run: planRun }),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes(se, planDate, planRun) });
      await refreshAfterRouteMutation(queryClient, String(data.plan_run_id));
    },
  });
}
