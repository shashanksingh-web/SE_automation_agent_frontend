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
import { RouteMap } from "@/features/routing/RouteMap";
import { cn } from "@/shared/lib/cn";
import type { RoutePlan } from "@/shared/types/routing";
import { ApiError } from "@/shared/api/client";

interface PlanDrawerProps {
  se: string | null;
  planDate: string;
  // DC_ID -> DC_Name, built by the caller from the SE's own task list (RouteStop only
  // carries dc_id - no name). Best-effort: a stop's DC won't have a name here if it
  // wasn't one of that SE's visible daily tasks (e.g. a dropped candidate).
  dcNames?: Record<string, string>;
  onClose: () => void;
}

const PLAN_LABELS: Record<RoutePlan["plan_type"], string> = {
  PRIORITY_MAX: "Priority-Max",
  DISTANCE_MIN: "Distance-Min",
  BALANCED: "Balanced",
};

// §10 - one card per plan, feasible first, is_default_selected pre-highlighted.
// select fires the /select/<plan_type>/ call. 422 (no route data / no DCs) is
// an empty state, not an error.
export function PlanDrawer({ se, planDate, dcNames = {}, onClose }: PlanDrawerProps) {
  const { data, isLoading, isError, error } = useRoutes(se ?? undefined, planDate);
  const selectMutation = useSelectRoutePlan(se ?? "", planDate);

  const is422 = isError && error instanceof ApiError && error.status === 422;

  const sortedPlans = Array.isArray(data?.plans)
    ? [...data.plans].sort((a, b) => Number(b.feasible) - Number(a.feasible))
    : [];

  return (
    <Drawer open={!!se} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Route plans{data && ` - ${data.se_name}`}</DrawerTitle>
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
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Stat label="Stops" value={plan.stop_count} />
                  <Stat label="Distance" value={`${plan.total_distance_km} km`} />
                  <Stat label="Total time" value={`${plan.total_minutes} min`} />
                </div>
                <RouteMap plan={plan} />
                {plan.stops.length > 0 && (
                  <ol className="max-h-32 space-y-1 overflow-auto text-xs text-muted-foreground">
                    {plan.stops.map((stop) => (
                      <li key={stop.dc_id}>
                        {stop.sequence_no}. {dcNames[stop.dc_id] ?? "Unknown DC"} (DC {stop.dc_id}) -{" "}
                        {stop.purposes} ({stop.distance_from_prev_km} km, {stop.travel_time_from_prev_min} min)
                      </li>
                    ))}
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
