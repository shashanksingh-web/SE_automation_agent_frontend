import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAppStore } from "@/shared/store/appStore";
import { useAuth } from "@/features/auth/AuthContext";
import { useAdminConfig } from "@/shared/api/hooks/useAdminConfig";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Badge } from "@/shared/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/cn";
import type { RoutingPlanChoice } from "@/shared/types/scope";

const PLAN_LABELS: Record<RoutingPlanChoice, string> = {
  A: "Plan A",
  B: "Plan B",
  C: "Plan C",
};

// Admin Control Panel -> Routing -> "SE view's routing plan" (planning/admin_config.py
// se_routing_plan, added 2026-09-15). Reads the live effective value out of the same
// AdminConfigResponse the Admin Control Panel itself edits - a plain lookup, not a
// dedicated endpoint, since GET /admin/config/ already returns every field grouped.
function useSeRoutingPlan(): RoutingPlanChoice {
  const { data } = useAdminConfig();
  const field = data?.Groups.flatMap((g) => g.Fields).find((f) => f.key === "se_routing_plan");
  return (field?.value as RoutingPlanChoice) ?? "A";
}

// Global control, same pattern as DateSelector - which Routing Agent mode
// (planning/models.py RoutePlan.PlanType, added 2026-08-31/2026-09-11) to generate:
// Plan A (Priority-Max/Distance-Min/Balanced), Plan B (Beat Planning / Cluster-Based:
// Efficiency/Score-Max/Distance-Min), or Plan C (AI-Reasoned via an LLM - 3 routes as of
// 2026-09-15, with each one's own reasoning, see PlanDrawer). Maps to ?routing_plan=A|B|C
// on every scope/tuff generation call - kept global rather than per-view since every
// scope GET regenerates the whole plan from scratch, so a stale per-view choice would get
// silently overwritten back to Plan A on the next passive fetch (see useScopePlanRun.ts).
//
// SE accounts get a read-only badge instead of this picker (added 2026-09-15, explicit
// user request - "selection of plan should be restrict for SE"), showing whatever the
// Admin Control Panel's "SE view's routing plan" field is set to (useSeRoutingPlan
// above) - same isScopeValueLockedToSelf-style lock ScopeSelector already applies to
// SE/ABM/RBM's own scope value, just for the plan choice instead. Every other role
// (Admin/ZBM/RBM/ABM) keeps the full interactive picker below, including when drilling
// into a specific SE's own plan - the lock is role-based, not scope-based.
//
// Plan C opened up to this UI 2026-09-11 (explicit user request, "open up plan C for
// triggering from the UI too") behind its own confirm step, unlike the plain A/B toggle
// - because routingPlan is global and threaded into every subsequent generation call
// (not just an explicit button press), silently leaving it on "C" means the NEXT scope
// switch/date change/passive refetch fires a real LLM call per SE in whatever scope
// loads next, without the admin having asked for that specific fetch to be AI-routed.
// The confirm is the only guard against that - same "cheap to pause, expensive to
// undo" reasoning as AllPlanRunsPanel's generate-all-states confirm.
//
// The Fixed Rotation checkbox (?rotation=true, added 2026-09-01 - Sheet 11 Model B)
// only does anything under Plan B (planning/routing.py: `if enable_rotation and
// plan_choice == "B"`), so it's disabled and visually muted under A/C rather than
// hidden outright - appStore.setRoutingPlan already resets it to false on that switch,
// so there's no stale-but-invisible state to worry about, just a clearer affordance.
export function RoutingPlanSelector() {
  const { user } = useAuth();
  const routingPlan = useAppStore((s) => s.routingPlan);
  const setRoutingPlan = useAppStore((s) => s.setRoutingPlan);
  const enableRotation = useAppStore((s) => s.enableRotation);
  const setEnableRotation = useAppStore((s) => s.setEnableRotation);
  const [confirmingC, setConfirmingC] = useState(false);
  const seRoutingPlan = useSeRoutingPlan();

  // SE accounts don't get to choose their own routing plan (explicit user request,
  // 2026-09-15: "selection of plan should be restrict for SE") - an admin-controlled
  // choice (Admin Control Panel -> Routing -> "SE view's routing plan") applies instead.
  // Pushed into the store here rather than left for the SE's own scope view to notice
  // it's wrong, same reasoning as ScopeSelector's isScopeValueLockedToSelf effect: a
  // value nobody ever explicitly sets stays stuck at appStore's initial default (Plan
  // A) forever, silently ignoring whatever the admin actually configured.
  useEffect(() => {
    if (user?.role === "SE" && routingPlan !== seRoutingPlan) {
      setRoutingPlan(seRoutingPlan);
    }
  }, [user, seRoutingPlan, routingPlan, setRoutingPlan]);

  const isSE = user?.role === "SE";

  const handleChoice = (choice: RoutingPlanChoice) => {
    if (choice === "C" && routingPlan !== "C") {
      setConfirmingC(true);
      return;
    }
    setRoutingPlan(choice);
  };

  return (
    <div className="flex items-center gap-2">
      {isSE ? (
        <Badge
          variant="outline"
          className="h-9 px-3"
          title="Set by an admin (Admin Control Panel -> Routing -> &quot;SE view's routing plan&quot;) - not something an SE account can change."
        >
          {PLAN_LABELS[seRoutingPlan]}
        </Badge>
      ) : (
        <div className="flex items-center gap-1 rounded-md border bg-background p-1" title="Which route-planning model family to generate">
          {(["A", "B"] as const).map((choice) => (
            <Button
              key={choice}
              type="button"
              size="sm"
              variant={routingPlan === choice ? "default" : "ghost"}
              className={cn(routingPlan === choice && "shadow-sm")}
              onClick={() => handleChoice(choice)}
            >
              {PLAN_LABELS[choice]}
            </Button>
          ))}
          <Popover open={confirmingC} onOpenChange={setConfirmingC}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={routingPlan === "C" ? "default" : "ghost"}
                className={cn(routingPlan === "C" && "shadow-sm")}
                onClick={() => handleChoice("C")}
              >
                {PLAN_LABELS.C}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Switch to Plan C?
              </p>
              <p className="text-xs text-muted-foreground">
                Plan C asks an LLM to pick and order each SE's stops (with its own reasoning) instead of the usual
                algorithm - a real API call per SE, slower than A/B, and stays selected for every scope/date you open
                next until you switch back.
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmingC(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setRoutingPlan("C");
                    setConfirmingC(false);
                  }}
                >
                  Switch to Plan C
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
      <label
        className={cn(
          "flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-sm",
          routingPlan !== "B" && "cursor-not-allowed opacity-50",
        )}
        title="Fixed Rotation (Plan B only): restrict each SE to today's assigned beat zone"
      >
        <Checkbox
          checked={enableRotation}
          disabled={routingPlan !== "B"}
          onCheckedChange={(checked) => setEnableRotation(checked === true)}
        />
        Fixed Rotation
      </label>
    </div>
  );
}
