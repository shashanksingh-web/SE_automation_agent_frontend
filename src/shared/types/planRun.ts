// DC Club Scheme standing (planning/views.py: _serialize_task's Club_Detail, sourced
// from se_daily_plan_agent.normalize_dc_club()). Club_Tier/Zone/TOD_Percent/Reward
// describe CURRENT standing - all null if not yet tiered (Is_Club_Enrolled can still be
// true). The Eligible_Tier_* trio describes what clearing Outstanding would unlock -
// all null once already tiered, or if Qualifying_Turnover doesn't clear even Copper's
// entry threshold. The two halves are mutually exclusive in practice (a DC is either
// already tiered, or - if not - may have an eligible-if-cleared tier), never both set.
export interface ClubDetail {
  Is_Club_Enrolled: boolean | null;
  Qualifying_Turnover: number | null;
  Outstanding_Cleared: boolean | null;
  Club_Tier: string | null;
  Zone: string | null;
  TOD_Percent: number | null;
  Reward: string | null;
  Eligible_Tier_If_Outstanding_Cleared: string | null;
  Eligible_Tier_TOD_Percent_If_Cleared: number | null;
  Eligible_Tier_Reward_If_Cleared: string | null;
}

// Task row fields (Plans[].Tasks[]) - drives the SE daily task table (spec §7).
export interface Task {
  // The DailyTask row's own DB id - what GET /pitch/<daily_task_id>/ actually needs
  // (not DC_ID, not Sr_No). Added to _serialize_task in the Django backend alongside
  // this frontend change - see planning/views.py.
  DailyTask_ID: number;
  Sr_No: number;
  DC_Name: string;
  DC_ID: string;
  Distance_Km: number | null;
  Recommended_Task_Type: string;
  Purpose_Of_Visit: string;
  Reason_Of_Visit: string;
  Last_Visit_Date: string | null;
  Days_Since_Last_Visit: number | null;
  Present_Outstanding: number | null;
  Present_Overdue: number | null;
  Overdue_Aging_Bucket: string | null;
  // dc_datamart.weighted_avg_repayment_days - a real, DC-wide average (not split by
  // the 0-90/90+ overdue buckets above). See planning/models.py: DailyTask.avg_repayment_days.
  Avg_Repayment_Days: number | null;
  Last_Order_Date: string | null;
  Last_Order_Value: number | null;
  Last_Payment_Date: string | null;
  Last_Payment_Join_Key_Unconfirmed: boolean | null;
  YTD_Private_Label: number | null;
  // A descriptive string (e.g. "Not enrolled", "Enrolled -- no tier yet (outstanding not
  // cleared)", or an enrollment tier name), not a boolean - see _build_candidate_row in
  // se_daily_plan_agent.py. Empty string on a resynced task (§ isResyncedTask), and
  // "Config_Ambiguous -- DC club data not supplied" when the source data isn't wired up
  // for this deployment at all.
  DC_Club_Participation: string | null;
  // Structured form of DC_Club_Participation's prose summary (se_daily_plan_agent.
  // normalize_dc_club(), confirmed 2026-08-19) - null under the same "club data wasn't
  // available this run" gate DC_Club_Participation's own "Config_Ambiguous" case uses.
  Club_Detail: ClubDetail | null;
  Objective: string | null;
  No_New_Orders: boolean | null;
  Credit_On_Hold: boolean | null;
  Credit_On_Hold_Reason: string | null;
  Estimated_Duration: number | null;
  Priority_Multiplier: number | null;
  // Cross-cutting "cover this one first" signal (confirmed 2026-08-18) - chronic miss
  // escalation (DCVisitStreak.consecutive_misses >= ESCALATION_THRESHOLD), a real
  // overdue balance aged 90+ days, or credit-on-hold. Critical_Reasons is a
  // semicolon-joined string of whichever of those actually applied (never fabricated -
  // "" when Critical is false), same convention as Credit_On_Hold_Reason.
  Critical: boolean;
  Critical_Reasons: string;
  // Planned-vs-actual reconciliation block - empty for future/unreconciled dates (§7).
  Outcome_Status: string | null;
  Actual_Visit_Date: string | null;
  Actual_Order_Value: number | null;
  Actual_Payment_Amount: number | null;
  Reconciled_At: string | null;
}

export interface SEPlan {
  SE_ID: string;
  SE_Name: string;
  Tasks: Task[];
}

export interface Exception {
  Record_ID: string;
  Source: string;
  Reason_Code: string;
  Detail: string;
  Run_Timestamp: string;
}

// Ground truth from the real backend (SE_automation_server/planning/models.py
// PlanRun.Status) - NOT the spec doc's hypothetical PENDING/RUNNING/COMPLETED/FAILED.
// Every scope/tuff GET generates and returns the plan synchronously in one request/
// response (services.generate_plan_for_scope / activate_tuff_scope) - there is no
// async "still generating" state to poll for. Status is a post-hoc *approval workflow*
// marker (has this run been reviewed?), defaulting to PENDING_REVIEW, not a lifecycle
// stage - see isRejected below and StatusBanner's approval framing.
export type PlanRunStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | string;

// A DC excluded before ever reaching qualification - Section 6 (Legal_Hold/visited-too-
// recently/DC_Rank_Ineligible), computed in services.py off the SE's full assigned DC
// list (not the scope-filtered one). Reason is a semicolon-joined string of whichever
// applied, "unknown" if none of the three checked reasons actually explain it (a real
// gap-flag, not a silent guess).
export interface SkippedSENotInScopeDC {
  DC_ID: string;
  DC_Name: string | null;
  Reason: string;
}

// A DC that passed scope but failed every one of the 3 qualifiers (Visits/Outstanding/
// PL) - se_daily_plan_agent.py's own Skipped_Qualification_Detail. Each field states
// what this DC's actual value was and what threshold it needed to clear, not just
// pass/fail, so the reader doesn't have to go re-derive that from other fields.
export interface SkippedSEUnqualifiedDC {
  DC_ID: string;
  DC_Name: string | null;
  Visits: string;
  Outstanding: string;
  PL: string;
}

export interface SkippedSE {
  se_id: string;
  se_email: string;
  reason: string;
  // Full root-cause breakdown (confirmed 2026-08-18) behind `reason`'s one-line summary
  // - the two tiers a manual investigation would otherwise have to reconstruct by hand.
  // Optional: absent on any skipped-SE record generated before this was added (older
  // PlanRuns re-served from the DB, not regenerated).
  dc_breakdown?: {
    total_assigned_dcs: number;
    not_in_scope: SkippedSENotInScopeDC[];
    in_scope_no_objective_match: SkippedSEUnqualifiedDC[];
  };
}

export interface PlanRunResponse {
  PlanRun_ID: string;
  Scope_Type: string;
  Scope_Value: string;
  Plan_Date: string;
  Run_Timestamp: string;
  Metabase_Configured: boolean;
  SE_Count: number;
  DC_Count: number;
  Task_Count: number;
  // A free-form config-resolution dict (7.3/8.5/4.4/4.5 custom values in effect for
  // this run), not a boolean - see PlanRun.dynamic_parameters in the Django model.
  Dynamic_Parameters_Resolved: Record<string, unknown>;
  Note: string | null;
  Skipped_SEs: SkippedSE[] | null;
  Status: PlanRunStatus;
  Reviewed_By: string | null;
  Reviewed_At: string | null;
  Error_Message: string | null;
  Started_At: string | null;
  Finished_At: string | null;
  Plans: SEPlan[];
  Exceptions_Report: Exception[];
  // Focus Product Campaign Targeting (planning/product_cohort.py) - product-first, not
  // DC-first, and strictly opt-in: always [] unless the request carried
  // ?focus_product=<materialId>. This frontend never sends that param yet, so this stays
  // empty in practice - typed here for accuracy (it's a real response field now), not
  // because anything renders it. Building that UI (product search, node/season config)
  // is a separate, standalone feature request.
  Focus_Product_Targets: FocusProductTarget[];
}

export interface FocusProductTarget {
  ID: number;
  Material_ID: string;
  Node_ID: string | null;
  Step_2A: Record<string, unknown> | null;
  Step_2B: Record<string, unknown> | null;
  Step_3: Record<string, unknown> | null;
  Generated_At: string;
}

export function isRejected(status: PlanRunStatus): boolean {
  return status === "REJECTED";
}

export function isApproved(status: PlanRunStatus): boolean {
  return status === "APPROVED";
}

// TUFF combined response (§9): normalization result + the same PlanRun shape.
export interface NormalizationResult {
  [key: string]: unknown;
}

export interface TuffResponse extends PlanRunResponse {
  Normalization: NormalizationResult;
}

export interface ApiErrorBody {
  error: string;
  // pitch_script()/dc_card() 404s only (see _no_pitch_or_card_response, views.py) -
  // "not_applicable" (Farmer Meeting task, expected) vs "generation_failed" (DC-tied
  // task that should have one but doesn't - a real failure) vs "no_such_task". Absent
  // on every other endpoint's error body.
  Reason?: "not_applicable" | "generation_failed" | "no_such_task";
}
