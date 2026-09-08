// DC Selection (added 2026-09-08, explicit user request - "in admin control panel we
// have select the dcs for this whole program"). Mirrors planning/dc_selection.py's
// response shapes exactly - GET/POST /api/planning/admin/dc-selection/,
// GET .../search/, POST .../upload-rank-csv/.

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

export interface OverdueRule {
  enabled: boolean;
  combine: DCSelectionCombine;
  min_amount: number;
}

export interface DCSelectionRules {
  rank_range: RankRangeRule;
  cohort: CohortRule;
  active_status: ActiveStatusRule;
  overdue: OverdueRule;
}

export interface DCSelectionState {
  Rules: DCSelectionRules;
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

// Selected DC List uploader (added 2026-09-08) - each uploaded DC_ID enriched with its
// DC_RAnk.csv Rank/Cohort; found=false means the ID isn't a real DC_RAnk.csv row (still
// added to Manual_Includes - the admin's explicit choice always wins - just flagged).
export interface UploadedDCRow {
  dc_id: string;
  dc_name: string | null;
  rank: number | string | null;
  cohort: string | null;
  found: boolean;
  // Explanatory string when found is false (why, and what it means for this DC); null
  // when found is true.
  reason: string | null;
}

export interface DCSelectionUploadResult extends DCSelectionState {
  Uploaded_Dc_Count?: number;
  Uploaded_Dcs?: UploadedDCRow[];
  Uploaded_Not_Found_Count?: number;
}
