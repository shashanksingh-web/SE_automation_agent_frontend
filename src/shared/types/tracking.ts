// GET /api/planning/admin/tracking/?days=N (planning/tracking.py, added 2026-09-16) -
// the Tracking dashboard's numbers, five tiers most-important-first. Every metric is
// computed at request time from what the pipeline already persists; a metric whose
// underlying data has never been produced is null (never a fabricated 0) alongside
// the count of what IS there, so the UI can say "never measured" honestly - e.g.
// Outcomes.Tasks_Reconciled is 0 of Tasks_Planned until reconcile_outcomes has run.
// Windowed on PlanRun.run_timestamp (when generated), not plan_date.

export interface TrackingWindow {
  Days: number;
  From: string;
  To: string;
  Plan_Runs: number;
}

// Tier 1 - does the plan change what SEs collect and sell. Sourced from DailyTask's
// outcome_status / actual_* fields, which ONLY reconcile_outcomes writes.
export interface TrackingOutcomes {
  // Planned visits = distinct (SE, DC, plan_date); Task_Rows is the raw DailyTask count,
  // which is far larger because every view load regenerates the scope's plan.
  Tasks_Planned: number;
  Task_Rows: number;
  Tasks_Reconciled: number;
  Reconciliation_Rate_Pct: number | null;
  // All-time, not windowed - "has this ever run" is the question it answers.
  Reconciliation_Last_Run_At: string | null;
  Visit_Execution_Rate_Pct: number | null;
  Outcome_Status_Breakdown: Record<string, number>;
  Overdue_Pitched: number | null;
  Collection_Realised: number | null;
  Sales_After_Visit: number | null;
  PTP_Promises: number;
  PTP_Promised_Amount: number | null;
  Chronic_Non_Execution_Pairs: number;
  Escalation_Threshold_Misses: number;
  // All-time: past DC-visit tasks still UNKNOWN - what POST /admin/reconcile/ acts on.
  Reconcilable_Now: number;
}

// POST /admin/reconcile/ - reconciles every past plan_date that still has UNKNOWN
// tasks, network-wide; idempotent.
export interface ReconcileResponse {
  Dates: number;
  Tasks: number;
  Completed: number;
  Partial: number;
  Missed: number;
  Escalated: number;
  Payment_Amount: number;
  Pull_Failures: string[];
  Lines: string[];
}

// Tier 2 - do SEs accept the plan or fight it.
export interface TrackingAdoption {
  Plan_Runs: number;
  By_Status: Record<string, number>;
  Approved: number;
  Rejected: number;
  Reviewed: number;
  Reviewed_Rate_Pct: number | null;
  Route_Plans: number;
  Manually_Edited_Routes: number;
  Manual_Edit_Rate_Pct: number | null;
  Selected_Plan_Type_Breakdown: Record<string, number>;
}

// Tier 3 - what the agents produced.
export interface TrackingQuality {
  Pitches: number;
  Pitches_AI: number;
  Pitches_Template: number;
  AI_Share_Pct: number | null;
  Hallucinated_Products_Dropped: number;
  Empty_Recommendation_Pct: number | null;
  Benefit_Text_Coverage_Pct: number | null;
  Route_Plans: number;
  Route_Avg_Distance_Km: number | null;
  Route_Avg_Minutes: number | null;
  Routes_Over_Budget: number;
  Routes_Over_Budget_Pct: number | null;
  Plans_Converged: number;
  Insufficient_Candidates: number;
  Generation_Latency_Sec: { Runs: number; Avg: number | null; P90: number | null; Max: number | null };
}

// Tier 4 - is the data feeding all of the above healthy. "Failures" are reason codes
// matching Failed/Error/Crash/Timeout; everything else is structural (a policy that
// applied and was logged by design), which is why the raw exception count is useless
// as an alarm on its own.
export interface TrackingDataHealth {
  Exceptions_Total: number;
  Exceptions_Failures: number;
  Exceptions_Structural: number;
  Failure_Codes: Record<string, number>;
  Top_Structural_Codes: Record<string, number>;
  Live_Pull_Failures_By_Source: Record<string, number>;
  Runs_With_A_Failure: number;
  Runs_With_A_Failure_Pct: number | null;
  Normalization_Last_Run_At: string | null;
  DC_Master_Rows: number | null;
  DC_Master_Geo_Coverage_Pct: number | null;
  Scheduled_Scopes: number;
}

// Tier 5 - the plumbing.
export interface TrackingOps {
  Alert_Webhook_Configured: boolean;
  // null when REDSHIFT_HOST isn't configured at all (nothing to probe).
  Redshift_Reachable: boolean | null;
  DB_Journal_Mode: string;
  DB_Busy_Timeout_Sec: number | null;
  DB_Transaction_Mode: string | null;
  Plan_Generation_Weekly_Off_Day: string | null;
}

export interface TrackingResponse {
  Window: TrackingWindow;
  Outcomes: TrackingOutcomes;
  Adoption: TrackingAdoption;
  Quality: TrackingQuality;
  Data_Health: TrackingDataHealth;
  Ops: TrackingOps;
  Generated_At: string;
}
