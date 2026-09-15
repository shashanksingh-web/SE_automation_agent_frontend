import { useAdminConfig } from "@/shared/api/hooks/useAdminConfig";
import { useAppStore } from "@/shared/store/appStore";
import type { RoutingPlanChoice } from "@/shared/types/scope";

// Admin Control Panel -> Routing -> "SE view's routing plan" (planning/admin_config.py
// se_routing_plan, added 2026-09-15). Reads the live effective value out of the same
// AdminConfigResponse the Admin Control Panel itself edits - a plain lookup, not a
// dedicated endpoint, since GET /admin/config/ already returns every field grouped.
//
// isResolved is false only while that first GET is still in flight. It flips true on
// success AND on failure - a failed config fetch falls back to Plan A (the field's own
// server-side default) rather than leaving every SE view gated shut forever.
export function useSeRoutingPlan(): { plan: RoutingPlanChoice; isResolved: boolean } {
  const { data, isPending } = useAdminConfig();
  const field = data?.Groups.flatMap((g) => g.Fields).find((f) => f.key === "se_routing_plan");
  return { plan: (field?.value as RoutingPlanChoice) ?? "A", isResolved: !isPending };
}

// Whether a generation call made with `routingPlan` right now would use the plan that
// will actually stick. Always true for Admin/ZBM/RBM/ABM, who pick their own plan. For
// an SE it's true only once the admin-configured plan has loaded AND the store already
// holds it - the SE's plan is pushed into appStore by RoutingPlanSelector's effect a
// render after the config lands, and between login and that effect the store still
// carries its initial default (Plan A).
//
// Added 2026-09-15 after a real failure: an SE opening their view fired the scope GET
// immediately with the default (Plan A), then again with the admin's Plan C once it
// loaded. Both are full synchronous plan generations against the single-writer SQLite
// dev DB - the wasted Plan A run held the write lock for ~76s, and the Plan C run the SE
// actually wanted timed out behind it with "database is locked" (502). Gating the query
// on this means the SE view fires exactly one generation, with the right plan.
export function useRoutingPlanSettled(routingPlan: RoutingPlanChoice): boolean {
  const role = useAppStore((s) => s.role);
  const { plan, isResolved } = useSeRoutingPlan();
  if (role !== "SE") return true;
  return isResolved && routingPlan === plan;
}
