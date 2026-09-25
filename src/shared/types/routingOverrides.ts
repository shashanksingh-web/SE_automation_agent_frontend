// Per-scope Routing ceiling overrides (planning/models.py RoutingScopeOverride, added
// 2026-09-11, explicit user request - "in routing parameter rule may be different for
// node, district, state or overall"). Resolution precedence: NODE overrides DISTRICT
// overrides STATE overrides the global Admin Control Panel / hardcoded default (Routing
// group in adminConfig.ts) - see se_daily_plan_agent.resolve_routing_ceilings. DISTRICT
// was added 2026-09-11 once Geo_Mapping_Normalized.json was confirmed to carry a dc_id
// field the backend can join on.
export type RoutingOverrideScopeType = "NODE" | "DISTRICT" | "STATE";

export interface RoutingScopeOverride {
  Scope_Type: RoutingOverrideScopeType;
  Scope_Value: string;
  // Each independently nullable - null means "not overridden at this scope, fall
  // through to a less-specific scope or the global default" for that one parameter.
  r1_2_max_travel_minutes: number | null;
  plan_a_max_round_trip_distance_km: number | null;
  plan_b_max_daily_distance_km: number | null;
  plan_b_max_daily_travel_minutes: number | null;
  Updated_At: string;
  Updated_By: string;
}

export const ROUTING_OVERRIDE_FIELDS = [
  { key: "r1_2_max_travel_minutes", label: "Plan A travel ceiling", unit: "min" },
  { key: "plan_a_max_round_trip_distance_km", label: "Plan A distance ceiling", unit: "km" },
  { key: "plan_b_max_daily_distance_km", label: "Plan B distance ceiling", unit: "km" },
  { key: "plan_b_max_daily_travel_minutes", label: "Plan B travel ceiling", unit: "min" },
] as const;
