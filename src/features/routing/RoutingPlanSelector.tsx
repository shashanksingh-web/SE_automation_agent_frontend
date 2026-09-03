import { useAppStore } from "@/shared/store/appStore";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { cn } from "@/shared/lib/cn";
import type { RoutingPlanChoice } from "@/shared/types/scope";

const PLAN_LABELS: Record<RoutingPlanChoice, string> = {
  A: "Plan A",
  B: "Plan B",
};

// Global control, same pattern as DateSelector - which of the Routing Agent's two
// families of 3 route models (planning/models.py RoutePlan.PlanType, added 2026-08-31)
// to generate: Plan A (Priority-Max/Distance-Min/Balanced) or Plan B (Beat Planning /
// Cluster-Based: Efficiency/Score-Max/Distance-Min). Maps to ?routing_plan=A|B on every
// scope/tuff generation call - kept global rather than per-view since every scope GET
// regenerates the whole plan from scratch, so a stale per-view choice would get silently
// overwritten back to Plan A on the next passive fetch (see useScopePlanRun.ts).
//
// The Fixed Rotation checkbox (?rotation=true, added 2026-09-01 - Sheet 11 Model B)
// only does anything under Plan B (planning/routing.py: `if enable_rotation and
// plan_choice == "B"`), so it's disabled and visually muted under Plan A rather than
// hidden outright - appStore.setRoutingPlan already resets it to false on that switch,
// so there's no stale-but-invisible state to worry about, just a clearer affordance.
export function RoutingPlanSelector() {
  const routingPlan = useAppStore((s) => s.routingPlan);
  const setRoutingPlan = useAppStore((s) => s.setRoutingPlan);
  const enableRotation = useAppStore((s) => s.enableRotation);
  const setEnableRotation = useAppStore((s) => s.setEnableRotation);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-md border bg-background p-1" title="Which route-planning model family to generate">
        {(["A", "B"] as const).map((choice) => (
          <Button
            key={choice}
            type="button"
            size="sm"
            variant={routingPlan === choice ? "default" : "ghost"}
            className={cn(routingPlan === choice && "shadow-sm")}
            onClick={() => setRoutingPlan(choice)}
          >
            {PLAN_LABELS[choice]}
          </Button>
        ))}
      </div>
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
