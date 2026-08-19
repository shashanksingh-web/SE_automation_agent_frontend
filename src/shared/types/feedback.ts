// Ground truth from SE_automation_server/planning/views.py - the spec doc's shapes for
// this endpoint group (headcount/streaks/completion-stats/scheduled-scopes/pitch) don't
// match the real backend at all; these were rewritten from the Django view source.

// Recommended-products list - same shape on both PitchResponse and dcCard.ts's
// DCCardResponse, but NOT the same values: PitchResponse's is any business segment (a
// general cross-sell signal), while DCCardResponse's is filtered to PRIVATE LABEL only
// (added 2026-08-18 per direct instruction - that section is titled Private Label and
// must never name a BRANDED product just because it outsold PL products among the same
// peers). Both share _format_product_list() for wording, just fed different lists -
// see planning/dc_card.py's module docstring / planning.services._peer_stats' segment
// param. Already folded into the Hindi prose as free text too; these are the same
// values pulled out structured. Up to 5 items, highest value first - widened 2026-08-18
// from a single top product per direct instruction. Never padded: a DC with only 2 real
// candidates gets a 2-item list, [] when there's nothing to recommend at all.
export interface RecommendedProductItem {
  Product_Name: string | null;
  Value: number | null;
  Category: string | null;
  Sub_Category: string | null;
  Brand: string | null;
  Business_Segment: string | null;
  // "block"/"node" - this DC's own dominant_category, peer-purchase ranked (block tried
  // first; "node" means the block itself had no peers with purchase data, so this
  // widened to the DC's node instead). "nearby_radius"/"nearby_node" - the DC's own
  // block+node peers had nothing at all to rank from, so this widened geographically
  // instead of showing nothing (planning.services._attach_nearby_product_recommendations:
  // every DC within 200km first, then the nearest 10 Nodes by centroid distance) - a
  // meaningfully weaker "what's trending near you" signal than a block/node one, worth
  // surfacing distinctly.
  Scope: "block" | "node" | "nearby_radius" | "nearby_node" | string | null;
}

export interface RecommendedProducts {
  Recommended_Products: RecommendedProductItem[];
}

// pitch_script() (views.py) - 404 body is the generic {error} shape, this is the 200 shape.
export interface PitchResponse extends RecommendedProducts {
  DailyTask_ID: number;
  SE: string; // se_name if set, else se_id - see pitch_script view
  DC_Name: string;
  Purpose_Key: string;
  Script_Hindi: string;
  Data_Sources_Used: string[];
  Data_Sources_Skipped: string[];
  Generated_At: string;
}

// headcount_bifurcation() with ?list=true (planning/headcount.py). Buckets are lists of
// emails, not counts or person objects - there is no display-name field anywhere for
// these roles, only email. Keying is by node/block/district/state name -> email[].
export interface HeadcountResponse {
  overall_total: number;
  se_role: string[];
  abm_role: string[];
  rbm_role: string[];
  no_role: string[];
  by_node: Record<string, string[]>;
  by_block: Record<string, string[]>;
  by_district: Record<string, string[]>;
  by_state: Record<string, string[]>;
}

// visit_streaks() (views.py) - no SE_Name/DC_Name field exists on DCVisitStreak.
export interface StreakEntry {
  SE_ID: string;
  DC_ID: string;
  Consecutive_Misses: number;
  Last_Outcome_Date: string | null;
  Updated_At: string;
}

// completion_stats() (views.py) - ObjectiveCompletionStats. Objective values are real
// objective names/combos ("PL", "Visits", "Outstanding", "Long-Term", "PL,Visits", ...),
// not "BO1"/"BO3" labels - those are just informal shorthand the spec doc used.
export interface CompletionStatsEntry {
  SE_ID: string;
  Objective: string;
  Completion_Rate_30d: number; // 0-1
  Sample_Size: number;
  Computed_At: string;
}

// scheduled_scopes() (views.py) - ScheduledScope. No Cron_Expression/Next_Run_At field
// exists; the cron schedule itself lives outside this table (run_scheduled_tuff), only
// Active/Last_Run_At/Created_At are tracked here.
export interface ScheduledScopeEntry {
  Scope_Type: string;
  Scope_Value: string;
  Active: boolean;
  Last_Run_At: string | null;
  Created_At: string;
}

// plan_run_list() (views.py) - matches the spec doc as-written.
export interface RunsListEntry {
  PlanRun_ID: string;
  Scope_Type: string;
  Scope_Value: string;
  Plan_Date: string;
  Status: string;
  Run_Timestamp: string;
  SE_Count: number;
  DC_Count: number;
  Task_Count: number;
}
