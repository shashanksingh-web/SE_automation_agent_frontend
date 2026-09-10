import { useEffect, useMemo } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/shared/components/ui/drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useRoutes, useSelectRoutePlan } from "@/shared/api/hooks/useRoutes";
import { useDCs } from "@/shared/api/hooks/useDirectory";
import { rememberDCName, getCachedDCName } from "@/shared/lib/dcNameCache";
import { RouteMap } from "@/features/routing/RouteMap";
import { cn } from "@/shared/lib/cn";
import type { RoutePlan, RoutePlanType } from "@/shared/types/routing";
import { routePlanFamily } from "@/shared/types/routing";
import type { Exception } from "@/shared/types/planRun";
import { ApiError } from "@/shared/api/client";

interface PlanDrawerProps {
  se: string | null;
  planDate: string;
  // DC_ID -> DC_Name, built by the caller from the SE's own task list (RouteStop only
  // carries dc_id - no name). Only covers today's selected/visible tasks - a dropped
  // candidate or a non-selected route alternative's stop won't be in here, which is why
  // this drawer backfills the gap itself below via directory/dcs/?se=... rather than
  // relying solely on the caller.
  dcNames?: Record<string, string>;
  // The PlanRun's full Exceptions_Report (already fetched/normalized by the caller for
  // the task table) - filtered down below to this SE's own RoutingAgent entries. Without
  // this, e.g. all 3 Plan B routes coming out stop-for-stop identical (a real, honestly-
  // logged outcome - see Insufficient_Candidates_For_3_Plans/Exceptional_DC_BO_Rule in
  // planning/routing.py) has zero visible explanation and reads as broken.
  exceptions?: Exception[];
  onClose: () => void;
}

// Exceptions_Report Detail strings are free text but follow one consistent shape from
// se_daily_plan_agent.py/planning/routing.py: "{se_email} @ {plan_date}[ (PLAN_TYPE)]: ...".
// Parses that prefix off so what's left reads as a plain sentence, and pulls out the
// plan_type when the exception is about one specific route rather than the SE's routes
// in general (e.g. Insufficient_Candidates_For_3_Plans has no plan_type - it's about all 3).
interface RoutingNote {
  planType: RoutePlanType | null;
  reasonCode: string;
  message: string;
}

function parseSeRoutingExceptions(exceptions: Exception[], seEmail: string, planDate: string): RoutingNote[] {
  const prefix = `${seEmail} @ ${planDate}`;
  return exceptions
    .filter((e) => e.Source === "RoutingAgent" && e.Detail.startsWith(prefix))
    .map((e) => {
      const rest = e.Detail.slice(prefix.length).replace(/^:\s*/, "");
      const withType = rest.match(/^\(([A-Z_]+)\):\s*(.*)$/);
      return withType
        ? { planType: withType[1] as RoutePlanType, reasonCode: e.Reason_Code, message: withType[2] }
        : { planType: null, reasonCode: e.Reason_Code, message: rest };
    });
}

// Origin_Point_Outlier_Overridden (planning/services.py, added 2026-09-04) - a
// different exception source (attendance_attendance, not RoutingAgent) with its own
// Detail format ("SE user_id={uid}: ..."), not the "{se_email} @ {date}" convention the
// routing notes above rely on - se_id (the numeric employee code, not the email) is the
// only thing that matches it, since Detail never carries the email at all. Fires once
// per SE per run (not per plan_type), when the SE's single most-recent punch-in
// disagreed with their last-30-day majority location and the majority won instead - see
// se_daily_plan_agent.resolve_typical_origin.
function findOriginOutlierNote(exceptions: Exception[], seId: string): string | null {
  const hit = exceptions.find(
    (e) => e.Reason_Code === "Origin_Point_Outlier_Overridden" && e.Detail.includes(`user_id=${seId}`),
  );
  return hit ? hit.Detail.replace(/^SE user_id=\d+:\s*/, "") : null;
}

// Plan A (Models 1-3) vs Plan B (Beat Planning / Cluster-Based Model, added 2026-08-31 -
// see RoutingPlanSelector) - a PlanRun only ever has one family's 3 rows, so plan_type
// alone tells you which family produced what's shown here (routePlanFamily).
const PLAN_LABELS: Record<RoutePlan["plan_type"], string> = {
  PRIORITY_MAX: "Priority-Max",
  DISTANCE_MIN: "Distance-Min",
  BALANCED: "Balanced",
  CLUSTER_BASED: "Cluster Efficiency-Balanced",
  CLUSTER_SCOREMAX: "Cluster Score-Maximizing",
  CLUSTER_DISTMIN: "Cluster Distance-Minimizing",
};

// §10 - one card per plan, feasible first, is_default_selected pre-highlighted.
// select fires the /select/<plan_type>/ call. 422 (no route data / no DCs) is
// an empty state, not an error.
export function PlanDrawer({ se, planDate, dcNames = {}, exceptions = [], onClose }: PlanDrawerProps) {
  const { data, isLoading, isError, error } = useRoutes(se ?? undefined, planDate);
  const selectMutation = useSelectRoutePlan(se ?? "", planDate);

  // Backfill for any stop not covered by the caller's dcNames (e.g. a dropped candidate,
  // or a stop on a route alternative other than today's selected one - see this prop's
  // own doc comment). directory/dcs' se filter matches Assigned_SE_Email, so it needs
  // data.se_name (the email - see planning/routing.py list_route_plans), not the `se`
  // prop itself, which TaskTable/PlanRunDetail populate with SE_ID (see
  // planning/services.py: DailyTask.se_id=str(uid)/se_name=email) - both resolve the
  // same SE server-side (_se_filter's dual lookup) but only the email works here. 1000
  // is directory/dcs' own hard cap (DC_Master rows for a single SE stay well under it).
  const { data: seDcs } = useDCs({ se: data?.se_name, limit: 1000 }, { enabled: !!data?.se_name });

  useEffect(() => {
    seDcs?.dcs.forEach((dc) => rememberDCName(dc.dc_id, dc.dc_name));
  }, [seDcs]);

  const resolvedDcNames = useMemo(() => {
    const merged = { ...dcNames };
    seDcs?.dcs.forEach((dc) => {
      if (!merged[dc.dc_id]) merged[dc.dc_id] = dc.dc_name;
    });
    return merged;
  }, [dcNames, seDcs]);

  const is422 = isError && error instanceof ApiError && error.status === 422;

  const sortedPlans = Array.isArray(data?.plans)
    ? [...data.plans].sort((a, b) => Number(b.feasible) - Number(a.feasible))
    : [];
  // A PlanRun only ever generates one family's 3 rows (routePlanFamily), so the first
  // plan's family represents the whole list - shown here since PLAN_LABELS below no
  // longer spells out "(Plan A/B)" per card now that there are 6 possible plan_types.
  const family = sortedPlans[0] ? routePlanFamily(sortedPlans[0].plan_type) : null;

  const routingNotes = data?.se_name ? parseSeRoutingExceptions(exceptions, data.se_name, planDate) : [];
  const generalNotes = routingNotes.filter((n) => n.planType === null);
  const originOutlierNote = data?.se_id ? findOriginOutlierNote(exceptions, data.se_id) : null;

  return (
    <Drawer open={!!se} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-2xl">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            Route plans{data && ` - ${data.se_name}`}
            {family && <Badge variant="secondary">Plan {family}</Badge>}
          </DrawerTitle>
          <DrawerDescription>{planDate}</DrawerDescription>
        </DrawerHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading route plans...
          </div>
        )}

        {is422 && (
          <div className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
            No route data for this SE / date - no DCs found in scope.
          </div>
        )}

        {isError && !is422 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Failed to load routes. Try again.
          </div>
        )}

        {generalNotes.length > 0 && (
          <div className="space-y-1 rounded-md border bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
            {generalNotes.map((n, i) => (
              <p key={i}>{n.message}</p>
            ))}
          </div>
        )}

        {originOutlierNote && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            <span className="font-semibold uppercase tracking-wide">Origin overridden:</span> {originOutlierNote}
          </div>
        )}

        <div className="space-y-3 overflow-auto">
          {sortedPlans.map((plan) => (
            <Card
              key={plan.plan_type}
              className={cn(
                !plan.feasible && "opacity-60",
                plan.is_default_selected && "border-primary ring-1 ring-primary",
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {PLAN_LABELS[plan.plan_type]}
                  {plan.is_default_selected && <Badge>Selected</Badge>}
                  {!plan.feasible && <Badge variant="destructive">Infeasible</Badge>}
                  {plan.distance_source === "google_maps" && (
                    <Badge
                      variant="secondary"
                      title="Distance/time for this route come from a real Google Maps Directions API call, not the Haversine x 1.4 estimate."
                    >
                      Google Maps verified
                    </Badge>
                  )}
                  {plan.google_exceeds_cap && (
                    <Badge
                      variant="warning"
                      title="Real Google Maps road distance/time for this route exceeds the cap the Haversine estimate had satisfied. Stops were not re-selected against this - only flagged."
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Exceeds cap on real roads
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant={plan.is_default_selected ? "secondary" : "outline"}
                  disabled={!plan.feasible || selectMutation.isPending}
                  onClick={() => selectMutation.mutate(plan.plan_type)}
                >
                  Select
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {!plan.feasible && plan.infeasibility_reason && (
                  <p className="text-xs text-destructive">{plan.infeasibility_reason}</p>
                )}
                {routingNotes
                  .filter((n) => n.planType === plan.plan_type)
                  .map((n, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {n.message}
                    </p>
                  ))}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Stat label="Stops" value={plan.stop_count} />
                  <Stat label="Distance" value={`${plan.total_distance_km} km`} />
                  <Stat label="Total time" value={`${plan.total_minutes} min`} />
                </div>
                {plan.stops.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Includes the return trip back to origin at day's end - not broken out as its own stop below,
                    which is why the stop list's distances/times add up to less than the totals above.
                  </p>
                )}
                <RouteMap plan={plan} />
                {plan.stops.length > 0 && (
                  <ol className="max-h-32 space-y-1 overflow-auto text-xs text-muted-foreground">
                    {plan.stops.map((stop) => {
                      const name = resolvedDcNames[stop.dc_id] ?? getCachedDCName(stop.dc_id);
                      return (
                        <li key={stop.dc_id}>
                          {stop.sequence_no}. {name ? `${name} (DC ${stop.dc_id})` : `DC ${stop.dc_id}`} -{" "}
                          {stop.purposes} ({stop.distance_from_prev_km} km, {stop.travel_time_from_prev_min} min)
                        </li>
                      );
                    })}
                  </ol>
                )}
                {plan.dropped_dcs.length > 0 && (
                  <p className="text-xs text-warning-foreground">
                    {plan.dropped_dcs.length} DC(s) dropped from this plan.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Generated {new Date(plan.generated_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
