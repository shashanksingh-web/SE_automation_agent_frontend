import type { PlanRunStatus } from "@/shared/types/planRun";

// Plan A (existing 3 models) vs Plan B (Beat Planning / Cluster-Based Model, added
// 2026-08-31) vs Plan C (AI-Reasoned via an LLM, added 2026-09-11 -
// planning/models.py RoutePlan.PlanType) - one PlanRun only ever generates one family's
// rows (planning/routing.py: generate_route_plans_for_se's plan_choice branch), chosen
// via ?routing_plan=A|B|C at plan-generation time (see scopeApi.get/normalizationApi.tuff),
// not at routes-list time. CHANGED 2026-09-15, explicit user request ("in plan c provide
// all routes") - Plan C now produces 3 rows too, same as Plan A/B: LLM_REASONED (route 1,
// whatever style the Admin Panel has configured), LLM_REASONED_VALUE_MAX (route 2,
// explicitly told to maximize real Rupee value captured), LLM_REASONED_DISTMIN (route 3,
// explicitly told to minimize distance) - see planning/routing.py's plan_choice=="C"
// branch. Previously ONE row; existing rows generated before this change still carry
// only LLM_REASONED and render exactly as before (routePlanFamily still resolves it to
// "C" on its own).
export type RoutePlanType =
  | "PRIORITY_MAX"
  | "DISTANCE_MIN"
  | "BALANCED"
  | "CLUSTER_BASED"
  | "CLUSTER_SCOREMAX"
  | "CLUSTER_DISTMIN"
  | "LLM_REASONED"
  | "LLM_REASONED_VALUE_MAX"
  | "LLM_REASONED_DISTMIN";

export const CLUSTER_PLAN_TYPES: RoutePlanType[] = [
  "CLUSTER_BASED",
  "CLUSTER_SCOREMAX",
  "CLUSTER_DISTMIN",
];

export const LLM_REASONED_PLAN_TYPES: RoutePlanType[] = [
  "LLM_REASONED",
  "LLM_REASONED_VALUE_MAX",
  "LLM_REASONED_DISTMIN",
];

export function routePlanFamily(planType: RoutePlanType): "A" | "B" | "C" {
  if (LLM_REASONED_PLAN_TYPES.includes(planType)) return "C";
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
  // Real DC name/geo, joined server-side from DC_Master_Normalized.json (added
  // 2026-09-15 - RouteStop itself persists no lat/lon, see that model's own docstring).
  // latitude/longitude are null for a real, confirmed reason: ~60% of DCs network-wide
  // have no coordinates on file at all (DC_Master data gap, not a bug) - RouteMap must
  // skip these from the map/route rather than plotting (0, 0) or guessing.
  dc_name: string | null;
  latitude: number | null;
  longitude: number | null;
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
  // ROI overlay (added 2026-09-15, explicit user request - "provide proper how its
  // effect the roi in no [number]"), every plan family (A/B/C). Real Rupees:
  // sum of (Present_Outstanding + Last_Order_Value) across this route's stops -
  // deliberately NOT the Pitching Agent's AI Sales Forecast, which runs AFTER Routing
  // in the pipeline and so cannot exist yet at route-generation time (planning/
  // routing.py: se_daily_plan_agent.attach_roi_metrics). null (not 0) whenever NONE of
  // this route's stops had either figure on file - check expected_value_dc_count
  // before reading a null as "genuinely zero value here."
  expected_value_captured: number | null;
  // expected_value_captured / total_distance_km - lets routes of different lengths be
  // compared on real-Rupees-per-km, not just raw total. null whenever
  // expected_value_captured itself is null, or the route's distance is ~0.
  value_per_km: number | null;
  // How many of this route's stop_count stops actually contributed a real Rupee
  // figure - "Rs.0 from 0 of 5 stops with data" must never be shown the same as
  // "Rs.0 from 5 of 5 stops that genuinely have no value at stake."
  expected_value_dc_count: number;
  // True once an SE has added/removed a stop via the edit-route-stops endpoints below
  // (added 2026-09-15, explicit user request - "if se wants add the dc in route plan
  // than he will add or wants to delete the route he will"). Distances/times ARE
  // recomputed for real on every edit, but priority_score_captured/
  // expected_value_captured above are NOT - RouteStop persists no per-stop priority/
  // financial breakdown to recompute them from - so this flags the UI to caveat those
  // two numbers as reflecting the algorithm's ORIGINAL stop set, not the current
  // (edited) one.
  manually_edited: boolean;
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
  // Whole-DAY approval state (added 2026-09-15, see accept_route_plan/reject_route_plan
  // in planning/routing.py) - a PlanRun-level field, not per-route, so it's here once
  // rather than repeated on every RoutePlan in `plans`. reviewed_by/reviewed_at are null
  // until an SE has Accepted or Rejected at least once for this PlanRun.
  status: PlanRunStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
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

// GET /routes/<se>/<plan_date>/accept/<plan_type>/ (accept_route_plan, planning/
// routing.py, added 2026-09-15) - an SE's own "Accept" action. Same shape as
// SelectRoutePlanResponse plus the PlanRun's new APPROVED status, since Accept does the
// same pick+resync AND marks the whole day's plan approved in one call.
export interface AcceptRoutePlanResponse extends SelectRoutePlanResponse {
  status: PlanRunStatus;
}

// GET /routes/<se>/<plan_date>/reject/ (reject_route_plan, planning/routing.py, added
// 2026-09-15) - an SE's own "Reject" action. Rejects the whole day's PlanRun (not one
// specific route alternative - PlanRun.status is a PlanRun-level field); deliberately
// does not touch DailyTask (explicit follow-up choice: "keeps existing tasks untouched").
export interface RejectRoutePlanResponse {
  plan_run_id: string;
  se_id: string;
  status: PlanRunStatus;
}

// GET /routes/<se>/<plan_date>/<plan_type>/stops/add|remove/?dc_id=... (edit_route_stops,
// planning/routing.py, added 2026-09-15) - an SE adding/removing a DC from their own
// route. Real distances/times are recomputed server-side (see that function's own
// docstring) but not echoed here beyond the totals below - the caller refetches the full
// routes list (same pattern useSelectRoutePlan already uses) to get the updated stop list.
export interface EditRouteStopResponse {
  plan_run_id: string;
  plan_type: RoutePlanType;
  action: "add" | "remove";
  dc_id: string;
  stop_count: number;
  total_distance_km: number;
  total_minutes: number;
  feasible: boolean;
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
