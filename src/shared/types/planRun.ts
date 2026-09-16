// DC Club Scheme standing (planning/views.py: _serialize_task's Club_Detail, sourced
// from se_daily_plan_agent.normalize_dc_club()). Club_Tier/Zone/TOD_Percent/Reward
// describe CURRENT standing - all null if not yet tiered (Is_Club_Enrolled can still be
// true). The Eligible_Tier_* trio describes what clearing Outstanding would unlock -
// all null once already tiered, or if Qualifying_Turnover doesn't clear even Copper's
// entry threshold. The two halves are mutually exclusive in practice (a DC is either
// already tiered, or - if not - may have an eligible-if-cleared tier), never both set.
// One objective's score, as computed for a specific DC (planning/views.py: _serialize_
// task's BO_Scores, raw passthrough of se_daily_plan_agent.py's dc_bo_scores dict - see
// Task.BO_Scores). grade is null when the underlying score is genuinely undefined (e.g.
// a Config_Ambiguous PL_Expected case), not a fabricated placeholder. basis is only
// present for some objectives (e.g. Outstanding tag which live source computed the
// score; PL doesn't) - confirmed from real API responses, not every key is always set.
export interface BOScore {
  // Confirmed nullable from real API responses (e.g. "no 4.4 growth multiplier defined
  // for category 'FERTILIZERS'") - a provisional/unscoreable case, not always a real
  // percentage. null score_pct always pairs with grade: null too.
  score_pct: number | null;
  grade: "A" | "B" | "C" | "D" | null;
  reason: string;
  basis?: string;
  // Sales/BO4 only, added 2026-09-04 - REMOVED 2026-09-07 (explicit user request,
  // "Stop computing Sales & Long-Term entirely") along with BO4/BO5 scoring itself; a
  // "Sales" key never appears in BO_Scores at all anymore, only Outstanding/PL. Kept
  // optional here (not deleted) only because PlanRuns generated before 2026-09-07 still
  // carry real historical mom_trend_pct data in their persisted BO_Scores JSON, viewable
  // via Run history - a plain month-over-month sales ratio (this 30d / prior 30d),
  // purely informational and never fed into score_pct/grade/BO_Composite_Score.
  mom_trend_pct?: number | null;
}

// One component of a DC's Composite Health Score (Source 3k, se_daily_plan_agent.py
// compute_dc_health_score - added 2026-09-06). Keys are component names (NRV, GM,
// GM_Pct, PL_Contribution, Return, Credit, OD). Credit/OD were hardcoded score_pct: 0/
// bucket: "Worst" for every DC until 2026-09-07 (data-access-blocked on a Locus-to-
// sap_partner_id bridge gap that turned out not to exist - "locus" is a third database
// reachable via the same Redshift connection as everything else) - both are now real,
// live-computed values like every other component, and DO participate in
// Health_Focus_Track qualification like the rest (no longer excluded). score_pct: null
// for a DC with too little history to compute Credit (fewer than 5 qualifying payments)
// or OD (no bridge/aging match) - missing-component rule treats it as 0 in the weighted
// composite, same as any other component, never a guess.
export interface HealthSubScore {
  score_pct: number | null;
  bucket: "Strong" | "Fine" | "Weak" | "Worst";
  // CLAMP((0.60 - score_pct) / 0.60, 0, 1) - continuous, not just the bucket label.
  urgency: number;
}

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
  // sale_orderrequest.partner_finance_status ("financed" | "non_financed"), from this
  // DC's most recent order of any status - same source Credit_On_Hold reads (added
  // 2026-09-03). This is the DC's CURRENT status, not a static attribute - confirmed
  // live it genuinely changes over a DC's order history. null means no order has this
  // field populated at all, not an assumed "non_financed".
  Finance_Status: "financed" | "non_financed" | null;
  // Full per-DC BO score dict (se_daily_plan_agent.py DailyTaskRow.BO_Scores, added
  // 2026-09-03) - the DC's complete score set as computed, not just the objective(s)
  // that actually matched/qualified it into this task (those already show up in
  // Reason_Of_Visit's own prose). Only ever contains Outstanding/PL as of 2026-09-07
  // (explicit user request, "Stop computing Sales & Long-Term entirely" - BO4/BO5
  // scoring removed entirely, not just excluded from selection like before) - Visits
  // stays a candidate-pool qualifier only, never per-DC scored, same as always. A
  // PlanRun generated before 2026-09-07 can still carry a real historical "Sales" key
  // (viewable via Run history) - not fabricated, just from before this removal. null/{}
  // when no BO scores were supplied for this DC this run.
  BO_Scores: Record<string, BOScore> | null;
  // Unweighted average of whatever score_pct/ratio/coverage_pct values BO_Scores has
  // (None entries skipped, not treated as 0 - se_daily_plan_agent.py _bo_composite_score,
  // added 2026-09-03). Not a confirmed/weighted formula - it averages differently-scaled
  // ratios (Outstanding's health_pct is capped 0-1; PL's momentum ratio can exceed 1.0,
  // so this can read above 1.0 for real outperformance). A brief 2026-09-06 GR-31
  // override made this prefer DC_Health_Score/100 when a real Health Score existed, but
  // that was REVERTED 2026-09-07 (explicit user request, "Health Score is a separate
  // score, not related to BO scoring" -> fully decouple) - always the plain BO-objective
  // average again, unconditionally, never influenced by Health Score. null when
  // BO_Scores had nothing usable to average.
  BO_Composite_Score: number | null;
  // 1 = lowest BO_Composite_Score (worst-performing/most in need of attention) among
  // THIS SE's own day's task list only (se_daily_plan_agent.py _assign_bo_ranks) - not a
  // network-wide rank, and not the same as Sr_No (the actual selection order). Dense
  // ranking: equal composite scores share a rank. null when there's no composite score
  // to rank by (e.g. a Farmer Meeting task, or no BO scores this run).
  BO_Rank: number | null;
  // DC Composite Health Score (Source 3k, added 2026-09-06) - a separate, parallel 1-100
  // scoring model from BO1-5, fully decoupled from it (a brief 2026-09-06 override made
  // it drive BO_Composite_Score/BO_Rank above, reverted 2026-09-07 - see that field's own
  // note). Only drives its own separate Health-Focus qualification track now, never
  // ranking. null when this DC had no Health Score computed this run (failed the
  // active/Days_Since_Last_Sale<=60 eligibility gate, or a genuinely inactive/onboarding
  // DC) - never fabricated as 0.
  DC_Health_Score: number | null;
  // 100 - DC_Health_Score. Same nullability as DC_Health_Score.
  Health_Gap: number | null;
  // All 7 components (NRV/GM/GM_Pct/PL_Contribution/Return/Credit/OD), even when this
  // DC didn't ultimately qualify for Health-Focus - shown for transparency same as the
  // Health Card. {} when DC_Health_Score is null.
  Health_Sub_Scores: Record<string, HealthSubScore> | null;
  // True if this DC's raw GM_FY_Value or GM% was negative - GM/GM_Pct sub-scores are
  // NOT run through the normal formula in that case (flagged for manual review instead
  // of producing a score that breaks the 0-1 convention), per business-confirmed logic.
  Negative_GM_Flag: boolean;
  // Whether this DC was ALSO selected today via the separate Health-Focus qualification
  // track (Weak/Worst on >=1 of the 5 live-computable components, or GR-28's current_
  // od>0 force-include) - independent of whether it was also BO-driven; a DC can be
  // both, see Health_Focus_Purposes.
  Health_Focus_Track: boolean;
  // Every qualifying component's purpose, "" + " " -joined (e.g. "Promise To Pay /
  // Collection + Sale"), ordered Collection > Sale (business-confirmed priority when
  // multiple components qualify at once) - a plain joined string, not an array
  // (se_daily_plan_agent.py DailyTaskRow.Health_Focus_Purposes is a CharField). "" when
  // Health_Focus_Track is false.
  Health_Focus_Purposes: string;
  // Credit line detail (added 2026-09-07, explicit user request) - raw fields from
  // credit_line_customercreditline (Locus DB), the same source Credit_Score's own
  // pct_paid_in_due/ard formula reads from (see Health_Sub_Scores.Credit) - NOT derived
  // from Credit_Score itself, a separate raw signal. null on all three when this DC has
  // no credit line row at all (same missing-component convention as every other Health
  // Score input - never guessed), independent of whether Credit_Score itself computed.
  Credit_Limit: number | null; // Total sanctioned limit.
  Available_Credit_Limit: number | null; // Remaining/utilizable credit.
  Credit_Active: boolean | null; // credit_line_customercreditline.status === "ACTIVE".
  // Promise To Pay tracking (Source 3j, added 2026-09-04) - the DC's MOST RECENT
  // commitment only (older ones are superseded). Promise_Status: "Pending" (date hasn't
  // arrived yet, too early to judge), "Kept" (a real SUCCESS payment landed between the
  // promise and its date - not required to cover the full amount), "Broken" (date
  // passed, no qualifying payment - this still force-qualifies the DC for Outstanding
  // regardless of balance, unaffected by the 2026-09-07 change below - but no longer
  // appends to Critical_Reasons/sets Critical on its own, see that field's own note), or
  // null (no promise on record for this DC). A zero-amount promise is a real recorded
  // commitment here, not junk data to filter out.
  Promise_To_Pay_Date: string | null;
  Promise_To_Pay_Amount: number | null;
  Promise_Status: "Pending" | "Kept" | "Broken" | null;
  // Cross-cutting "cover this one first" signal (confirmed 2026-08-18) - chronic miss
  // escalation (DCVisitStreak.consecutive_misses >= ESCALATION_THRESHOLD), a real
  // overdue balance aged 90+ days, or credit-on-hold. A broken Promise To Pay used to
  // also count (and was the most common reason shown in practice) but was explicitly
  // removed 2026-09-07 - still fully visible via Promise_Status/_Date/_Amount and still
  // force-qualifies Outstanding, just no longer flagged in this banner. Critical_Reasons
  // is a semicolon-joined string of whichever of the 3 remaining conditions actually
  // applied (never fabricated - "" when Critical is false), same convention as
  // Credit_On_Hold_Reason.
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
