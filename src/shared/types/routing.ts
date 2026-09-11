// Plan A (existing 3 models) vs Plan B (Beat Planning / Cluster-Based Model, added
// 2026-08-31) vs Plan C (AI-Reasoned via an LLM, added 2026-09-11 -
// planning/models.py RoutePlan.PlanType) - one PlanRun only ever generates one family's
// rows (planning/routing.py: generate_route_plans_for_se's plan_choice branch), chosen
// via ?routing_plan=A|B at plan-generation time (see scopeApi.get/normalizationApi.tuff),
// not at routes-list time. Plan C is deliberately ONE row, not 3 (R5.1's "minimum 3"
// doesn't apply to a single-model LLM mode) - and isn't triggerable from this app yet:
// the HTTP API's own ?routing_plan= validation (planning/views.py
// _routing_plan_choice_from_get) still only accepts A/B, so a Plan C row only exists
// today if it was generated via the interactive CLI (generate_se_plan.py/
// activate_tuff.py --routing-plan C). LLM_REASONED is included here purely so the Plan
// Drawer can correctly display one if it shows up, not to imply it can be requested
// from this UI.
export type RoutePlanType =
  | "PRIORITY_MAX"
  | "DISTANCE_MIN"
  | "BALANCED"
  | "CLUSTER_BASED"
  | "CLUSTER_SCOREMAX"
  | "CLUSTER_DISTMIN"
  | "LLM_REASONED";

export const CLUSTER_PLAN_TYPES: RoutePlanType[] = [
  "CLUSTER_BASED",
  "CLUSTER_SCOREMAX",
  "CLUSTER_DISTMIN",
];

export function routePlanFamily(planType: RoutePlanType): "A" | "B" | "C" {
  if (planType === "LLM_REASONED") return "C";
  return CLUSTER_PLAN_TYPES.includes(planType) ? "B" : "A";
}

export interface RouteStop {
  sequence_no: number;
  dc_id: string;
  // A single string (the task's Purpose_Of_Visit, e.g. "Sale + Promise To Pay /
  // Collection") - not an array. See planning/routing.py: `purposes=stop["row"].Purpose_Of_Visit`.
  purposes: string;
  distance_from_prev_km: number;
  travel_time_from_prev_min: number;
}

export interface DroppedDC {
  dc_id: string;
  reason: string;
}

// Google Maps route-accuracy overlay (added 2026-09-10, wired into this API 2026-09-10)
// - applied only to the already-selected final route (BO-scored/model-chosen stops),
// never to the candidate-pool search that picked them, so this never changes WHICH
// stops are on the route, only how accurate total_distance_km/total_travel_minutes are.
export type DistanceSource = "haversine_x1.4" | "google_maps";

export interface RoutePlan {
  plan_type: RoutePlanType;
  is_default_selected: boolean;
  stop_count: number;
  total_distance_km: number;
  total_travel_minutes: number;
  total_visit_minutes: number;
  total_minutes: number;
  priority_score_captured: number | null;
  // GR-R10 audit trail - the ops assumptions behind the totals above. avg_speed_kmph_used
  // applies to all 3 models; alpha_used (BALANCED's priority/travel blend weight) is null
  // for the other two. See planning/routing.py: RoutePlan.objects.create(...).
  avg_speed_kmph_used: number | null;
  alpha_used: number | null;
  // "haversine_x1.4" (default) means total_distance_km/total_travel_minutes are the
  // cheap estimate - either Google Maps isn't configured or the live call failed this
  // run (fail-open, same number this route would have carried before this feature
  // existed). "google_maps" means they're a real Directions API result for this exact
  // route. google_exceeds_cap only means something when distance_source is
  // "google_maps": the real distance/time breaches the cap the Haversine estimate had
  // satisfied - flagged, not re-decided (stop selection is never re-run against it).
  distance_source: DistanceSource;
  google_exceeds_cap: boolean;
  // Plan C only (planning/models.py RoutePlan.llm_reasoning) - the LLM's own
  // explanation for these stops/order, plus any system notes (a hallucinated DC_ID
  // dropped, a cap-breach trim) appended by build_route_llm_reasoned. null for every
  // Plan A/B row and whenever the model returned no explanation.
  llm_reasoning: string | null;
  feasible: boolean;
  infeasibility_reason: string | null;
  origin_lat: number | null;
  origin_lon: number | null;
  origin_basis: string | null;
  generated_at: string;
  stops: RouteStop[];
  dropped_dcs: DroppedDC[];
}

export interface RoutesResponse {
  plan_run_id: string;
  se_id: string;
  se_name: string;
  plan_date: string;
  plans: RoutePlan[];
}

// GET /routes/<se>/<plan_date>/select/<plan_type>/ (select_default_route_plan,
// planning/routing.py) returns a small confirmation object, NOT the same {plans: [...]}
// list shape as the plain routes GET above - flips is_default_selected server-side and
// re-syncs DailyTask rows, but doesn't echo the updated plan list back. Conflating this
// with RoutesResponse crashes the Plan Drawer the moment a plan is selected (`data.plans`
// is undefined here).
export interface SelectRoutePlanResponse {
  plan_run_id: string;
  se_id: string;
  selected: RoutePlanType;
  daily_tasks_resynced: number;
}

export const ROUTE_PLAN_TYPES: RoutePlanType[] = [
  "PRIORITY_MAX",
  "DISTANCE_MIN",
  "BALANCED",
  "CLUSTER_BASED",
  "CLUSTER_SCOREMAX",
  "CLUSTER_DISTMIN",
  "LLM_REASONED",
];
