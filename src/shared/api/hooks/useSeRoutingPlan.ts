import { useAdminConfig } from "@/shared/api/hooks/useAdminConfig";
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
