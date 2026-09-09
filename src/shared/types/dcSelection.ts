// DC Selection (added 2026-09-08, explicit user request - "in admin control panel we
// have select the dcs for this whole program"; upload flow REDESIGNED 2026-09-08 per
// further spec - "when user upload the file of dc - it goes to dc data mart table
// exist than filter out with reasoning matched dc goes to dcrank csv for rank and
// cohort"). Mirrors planning/dc_selection.py's response shapes exactly - GET/POST
// /api/planning/admin/dc-selection/, GET .../search/, POST .../upload-rank-csv/,
// POST .../upload-selected-dcs/.

export type DCSelectionCombine = "AND" | "OR";

export interface RankRangeRule {
  enabled: boolean;
  combine: DCSelectionCombine;
  min: number | null;
  max: number | null;
}

export interface CohortRule {
  enabled: boolean;
  combine: DCSelectionCombine;
  values: string[];
}

export interface ActiveStatusRule {
  enabled: boolean;
  combine: DCSelectionCombine;
  value: "active" | "inactive";
}

// CHANGED 2026-09-08, explicit user request ("overdue yes or no"): was a numeric
// min_amount threshold - now a simple has-overdue-or-not toggle.
export interface OverdueRule {
  enabled: boolean;
  combine: DCSelectionCombine;
  value: "yes" | "no";
}

export interface DCSelectionRules {
  rank_range: RankRangeRule;
  cohort: CohortRule;
  active_status: ActiveStatusRule;
  overdue: OverdueRule;
}

// Added 2026-09-08, explicit user request - "user have option for one option which is
// uploaded consider filter or uploaded dc with also include other dc with filter select
// (optional)". "uploaded_only" suppresses the AND/OR rule entirely (Manual_Includes IS
// the selection); "uploaded_plus_filter" (default) unions Manual_Includes on top of
// whatever the rule computes, same as this feature has always done.
export type DCSelectionUploadMode = "uploaded_plus_filter" | "uploaded_only";

export interface DCSelectionState {
  Rules: DCSelectionRules;
  // Always the raw stored rule the admin is editing, regardless of Upload_Mode - the
  // mode only controls whether it's actually applied, so switching to "uploaded_only"
  // doesn't erase a configured rule that can be switched back to later.
  Upload_Mode: DCSelectionUploadMode;
  Manual_Includes: string[];
  Manual_Excludes: string[];
  // True once any criterion is enabled or a manual list is non-empty - this is what
  // decides whether the next plan generation uses this rule at all (see
  // se_daily_plan_agent.apply_dc_exclusion_rules' program_dc_gate_active).
  Configured: boolean;
  Universe_Size: number;
  // null when Configured is false (nothing to compute yet).
  Selected_Count: number | null;
  // False when the live dc_datamart query failed this request - active_status/overdue
  // then can't be evaluated (every DC fails those two criteria, same fail-closed-per-
  // criterion behavior as a missing dc_datamart row anywhere else in this pipeline).
  Live_Query_Ok: boolean;
  Rank_Csv_Uploaded_At: string | null;
  Rank_Csv_Uploaded_By: string;
  Rank_Csv_Row_Count: number | null;
  Updated_At: string | null;
  Updated_By: string;
  Dc_Master_Errors: string[];
}

export interface DCSelectionSearchRow {
  dc_id: string;
  dc_name: string | null;
  node: string | null;
  state: string | null;
  rank: number | string | null;
  cohort: string | null;
  is_active: boolean | null;
  overdue: number | null;
  in_selection: boolean;
  manually_included: boolean;
  manually_excluded: boolean;
}

export interface DCSelectionSearchResult {
  total: number;
  limit: number;
  offset: number;
  returned: number;
  dcs: DCSelectionSearchRow[];
}

export type DCSelectionFilterMode = "all" | "selected" | "excluded";

// Selected DC List uploader - REWRITTEN 2026-09-08 per direct spec: dc_datamart is the
// gate (an ID genuinely absent from a successfully-returned dc_datamart pull is
// REJECTED outright, never added to Manual_Includes), DC_RAnk.csv is a soft, second
// lookup for accepted IDs only (missing there doesn't reject - it's enrichment).
export interface UploadedDCRow {
  dc_id: string;
  dc_name: string | null;
  rank: number | string | null;
  cohort: string | null;
  is_active: boolean | null;
  overdue: number | null;
  // Passed the dc_datamart gate and was added to Manual_Includes. NOT about DC_RAnk.csv
  // presence - see in_rank_csv for that.
  found: boolean;
  // Present (Rank/Cohort/Name populated) in DC_RAnk.csv - independent of `found`; a DC
  // can be found=true (accepted) with in_rank_csv=false (no Rank/Cohort yet).
  in_rank_csv: boolean;
  // True when the dc_datamart query itself failed this request, not that the ID was
  // checked and found missing - every ID is accepted (fail-open) when this is true.
  dc_datamart_unverified: boolean;
  // Explanatory string when found is false; null when found is true.
  reason: string | null;
}

export interface DCSelectionUploadResult extends DCSelectionState {
  Uploaded_Dc_Count?: number;
  // Passed the dc_datamart gate and were added to Manual_Includes.
  Uploaded_Accepted_Count?: number;
  Uploaded_Dcs?: UploadedDCRow[];
  // Rejected (genuinely absent from a successfully-queried dc_datamart) - 0 whenever
  // Uploaded_Dc_Datamart_Unverified is true, since nothing gets rejected on a query
  // failure.
  Uploaded_Not_Found_Count?: number;
  // True when the dc_datamart query itself failed for this upload - every ID was
  // accepted regardless of whether it's a real DC, so the admin should know the gate
  // didn't actually run.
  Uploaded_Dc_Datamart_Unverified?: boolean;
}
