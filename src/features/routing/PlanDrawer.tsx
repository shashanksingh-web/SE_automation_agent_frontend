import { useEffect, useMemo } from "react";
import { Loader2, AlertTriangle, X } from "lucide-react";
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
import {
  useRoutes,
  useSelectRoutePlan,
  useAcceptRoutePlan,
  useRejectRoutePlan,
  useAddRouteStop,
  useRemoveRouteStop,
} from "@/shared/api/hooks/useRoutes";
import { useDCs } from "@/shared/api/hooks/useDirectory";
import { useAuth } from "@/features/auth/AuthContext";
import { rememberDCName, getCachedDCName } from "@/shared/lib/dcNameCache";
import { RouteMap } from "@/features/routing/RouteMap";
import { StatusBanner, ReviewedBadge } from "@/features/views/shared/StatusBanner";
import { SingleSelectCombobox, type SingleSelectOption } from "@/shared/components/SingleSelectCombobox";
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

// Plan A (Models 1-3) vs Plan B (Beat Planning / Cluster-Based Model, added 2026-08-31)
// vs Plan C (AI-Reasoned via an LLM, added 2026-09-11, now 3 routes as of 2026-09-15 -
// see RoutingPlanSelector for why there's no "Plan C" button there yet) - a PlanRun only
// ever has one family's rows, so plan_type alone tells you which family produced what's
// shown here (routePlanFamily).
const PLAN_LABELS: Record<RoutePlan["plan_type"], string> = {
  PRIORITY_MAX: "Priority-Max",
  DISTANCE_MIN: "Distance-Min",
  BALANCED: "Balanced",
  CLUSTER_BASED: "Cluster Efficiency-Balanced",
  CLUSTER_SCOREMAX: "Cluster Score-Maximizing",
  CLUSTER_DISTMIN: "Cluster Distance-Minimizing",
  LLM_REASONED: "AI-Reasoned",
  LLM_REASONED_VALUE_MAX: "AI-Reasoned Value-Max",
  LLM_REASONED_DISTMIN: "AI-Reasoned Distance-Min",
};

// Same convention as TaskTable.tsx/DCCardPanel's own currencyFormatter - a bare number
// (e.g. "5993104") reads as ambiguous next to a km/min figure, not obviously Rupees.
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// SE's own route-editing rights (added 2026-09-15, explicit user request - "In se have
// the right ... accept and reject cta ... add the dc ... or wants to delete", follow-up
// choice: edits allowed up to and including today, never a date that's passed).
const TODAY_ISO = new Date().toISOString().slice(0, 10);

// §10 - one card per plan, feasible first, is_default_selected pre-highlighted.
// select fires the /select/<plan_type>/ call. 422 (no route data / no DCs) is
// an empty state, not an error.
export function PlanDrawer({ se, planDate, dcNames = {}, exceptions = [], onClose }: PlanDrawerProps) {
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useRoutes(se ?? undefined, planDate);
  const selectMutation = useSelectRoutePlan(se ?? "", planDate);
  const acceptMutation = useAcceptRoutePlan(se ?? "", planDate, undefined, user?.email);
  const rejectMutation = useRejectRoutePlan(se ?? "", planDate, undefined, user?.email);
  const addStopMutation = useAddRouteStop(se ?? "", planDate);
  const removeStopMutation = useRemoveRouteStop(se ?? "", planDate);

  // Only an SE gets Accept/Reject + add/remove-DC rights on their OWN plan (every other
  // role keeps the plain "Select" browsing button, unchanged) - same role check
  // RoutingPlanSelector already uses to lock the A/B/C picker for SE.
  const isSE = user?.role === "SE";
  // Edits (add/remove DC) are only allowed for today or a future date, never one that's
  // already passed - enforced server-side too (edit_route_stops' own date check), this
  // just avoids showing controls that would 422 if used.
  const isEditableDate = planDate >= TODAY_ISO;

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

        {data && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBanner status={data.status} errorMessage={null} />
            <ReviewedBadge reviewedBy={data.reviewed_by} reviewedAt={data.reviewed_at} />
          </div>
        )}
        {rejectMutation.isError && (
          <p className="text-xs text-destructive">
            {rejectMutation.error instanceof ApiError ? rejectMutation.error.message : "Could not reject this plan."}
          </p>
        )}

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
            <PlanCard
              key={plan.plan_type}
              plan={plan}
              isSE={isSE}
              isEditableDate={isEditableDate}
              resolvedDcNames={resolvedDcNames}
              routingNotes={routingNotes.filter((n) => n.planType === plan.plan_type)}
              selectMutation={selectMutation}
              acceptMutation={acceptMutation}
              rejectMutation={rejectMutation}
              addStopMutation={addStopMutation}
              removeStopMutation={removeStopMutation}
            />
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface PlanCardProps {
  plan: RoutePlan;
  isSE: boolean;
  isEditableDate: boolean;
  resolvedDcNames: Record<string, string>;
  routingNotes: RoutingNote[];
  selectMutation: ReturnType<typeof useSelectRoutePlan>;
  acceptMutation: ReturnType<typeof useAcceptRoutePlan>;
  rejectMutation: ReturnType<typeof useRejectRoutePlan>;
  addStopMutation: ReturnType<typeof useAddRouteStop>;
  removeStopMutation: ReturnType<typeof useRemoveRouteStop>;
}

// Extracted to its own top-level component (added 2026-09-15, alongside SE's
// Accept/Reject/add-remove-DC rights) - each card now owns real per-card state (the
// "add a DC" picker's current selection), which would remount/lose state on every
// PlanDrawer re-render if this stayed inline (same nested-component anti-pattern
// UserTableRow was deliberately refactored away from earlier this session).
function PlanCard({
  plan,
  isSE,
  isEditableDate,
  resolvedDcNames,
  routingNotes,
  selectMutation,
  acceptMutation,
  rejectMutation,
  addStopMutation,
  removeStopMutation,
}: PlanCardProps) {
  // Sourced from THIS route's own dropped_dcs (added 2026-09-15, explicit follow-up
  // request - "list of dc when we select only those which are eligible pool"; was
  // previously every DC assigned to the SE, per an earlier explicit choice, but that
  // included DCs excluded by Program DC Selection/eligibility rules that never reached
  // this route's own Ranked_Pool at all - see edit_route_stops' own docstring for why
  // dropped_dcs is the correct "eligible pool" source, and RouteDroppedDC's docstring
  // for why it's guaranteed to cover every eligible candidate this route didn't select).
  // Geo_Incomplete-reasoned drops are excluded - the routing agent already knows those
  // can't be routed to.
  const addableOptions: SingleSelectOption[] = plan.dropped_dcs
    .filter((d) => d.reason !== "Geo_Incomplete")
    .map((d) => ({ value: d.dc_id, label: d.dc_name ?? d.dc_id, sublabel: d.dc_id }));

  const editsPending = addStopMutation.isPending || removeStopMutation.isPending;
  const editError =
    (addStopMutation.isError && addStopMutation.variables?.planType === plan.plan_type) ||
    (removeStopMutation.isError && removeStopMutation.variables?.planType === plan.plan_type)
      ? addStopMutation.error ?? removeStopMutation.error
      : null;

  return (
    <Card
      className={cn(
        !plan.feasible && "opacity-60",
        plan.is_default_selected && "border-primary ring-1 ring-primary",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          {PLAN_LABELS[plan.plan_type]}
          {plan.is_default_selected && <Badge>Selected</Badge>}
          {!plan.feasible && <Badge variant="destructive">Infeasible</Badge>}
          {plan.manually_edited && (
            <Badge
              variant="secondary"
              title="This route's stops were edited by the SE. Distance/time above are recomputed for real, but Value captured/Value per km still reflect the algorithm's ORIGINAL stop set, not this edited one."
            >
              Manually edited
            </Badge>
          )}
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
        {isSE ? (
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant={plan.is_default_selected ? "secondary" : "default"}
              disabled={!plan.feasible || acceptMutation.isPending}
              onClick={() => acceptMutation.mutate(plan.plan_type)}
            >
              Accept
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant={plan.is_default_selected ? "secondary" : "outline"}
            disabled={!plan.feasible || selectMutation.isPending}
            onClick={() => selectMutation.mutate(plan.plan_type)}
          >
            Select
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!plan.feasible && plan.infeasibility_reason && (
          <p className="text-xs text-destructive">{plan.infeasibility_reason}</p>
        )}
        {plan.llm_reasoning && (
          <div className="rounded-md border bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">AI reasoning:</span> {plan.llm_reasoning}
          </div>
        )}
        {routingNotes.map((n, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {n.message}
          </p>
        ))}
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <Stat label="Stops" value={plan.stop_count} />
          <Stat label="Distance" value={`${plan.total_distance_km} km`} />
          <Stat label="Total time" value={`${plan.total_minutes} min`} />
          <Stat
            label="Value captured"
            value={plan.expected_value_captured != null ? currencyFormatter.format(plan.expected_value_captured) : "-"}
            title={
              plan.manually_edited
                ? "Reflects the algorithm's ORIGINAL stop set, not this route's current (manually edited) one - RouteStop doesn't persist enough per-stop data to recompute it after an edit."
                : plan.expected_value_dc_count < plan.stop_count
                  ? `Only ${plan.expected_value_dc_count} of ${plan.stop_count} stops had a real Present_Outstanding/Last_Order_Value figure on file - the rest contributed Rs.0, not fabricated.`
                  : "Sum of Present_Outstanding + Last_Order_Value across this route's stops - real Rupees, not the (currently unavailable) AI Sales Forecast."
            }
          />
          <Stat
            label="Value / km"
            value={plan.value_per_km != null ? currencyFormatter.format(plan.value_per_km) : "-"}
            title="Value captured divided by total distance - compares routes of different lengths on Rupees realized per km driven."
          />
        </div>
        {plan.stops.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Includes the return trip back to origin at day's end - not broken out as its own stop below, which is
            why the stop list's distances/times add up to less than the totals above.
          </p>
        )}
        <RouteMap plan={plan} />
        {plan.stops.length > 0 && (
          <ol className="space-y-1 text-xs text-muted-foreground">
            {plan.stops.map((stop) => {
              const name = resolvedDcNames[stop.dc_id] ?? getCachedDCName(stop.dc_id);
              return (
                <li key={stop.dc_id} className="flex items-center justify-between gap-2">
                  <span>
                    {stop.sequence_no}. {name ? `${name} (DC ${stop.dc_id})` : `DC ${stop.dc_id}`} - {stop.purposes} (
                    {stop.distance_from_prev_km} km, {stop.travel_time_from_prev_min} min)
                  </span>
                  {isSE && isEditableDate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      title={
                        plan.stops.length <= 1
                          ? "Cannot remove the only stop on this route - Reject the whole route instead."
                          : `Remove ${name ?? stop.dc_id} from this route`
                      }
                      disabled={plan.stops.length <= 1 || editsPending}
                      onClick={() => removeStopMutation.mutate({ planType: plan.plan_type, dcId: stop.dc_id })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {isSE && isEditableDate && (
          <div className="flex items-center gap-2">
            <SingleSelectCombobox
              className="w-64"
              options={addableOptions}
              value=""
              placeholder="Add a DC from your scope..."
              disabled={editsPending}
              onChange={(dcId) => addStopMutation.mutate({ planType: plan.plan_type, dcId })}
            />
            {editsPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}
        {editError && (
          <p className="text-xs text-destructive">
            {editError instanceof ApiError ? editError.message : "Could not update this route."}
          </p>
        )}
        {plan.dropped_dcs.length > 0 && (
          <p className="text-xs text-warning-foreground">{plan.dropped_dcs.length} DC(s) dropped from this plan.</p>
        )}
        <p className="text-xs text-muted-foreground">Generated {new Date(plan.generated_at).toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div className="rounded-md border px-2 py-1.5" title={title}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
