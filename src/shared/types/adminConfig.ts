// Admin Control Panel (planning/admin_config.py, added 2026-09-07) - live-editable
// overrides onto se_daily_plan_agent.BusinessConstants' hardcoded Python defaults, built
// off the SE_Daily_Task_Agent_Pipeline_Walkthrough sheet's Steps 1-12. GET/POST
// /api/planning/admin/config/ share this exact response shape (POST returns the same
// state after applying changes, plus Errors).

export interface AdminConfigField {
  group: string;
  key: string;
  type: "int" | "float";
  label: string;
  unit: string;
  min: number;
  max: number;
  description: string;
  // "constants" (a BusinessConstants attribute, the majority of fields) or "module" (a
  // bare se_daily_plan_agent module-level constant - currently only the Step 11 Routing
  // group, added 2026-09-07 "routing agent ceiling also configurable"). Both are
  // editable the same way from this frontend's perspective (same PATCH shape, same
  // validation) - the distinction only matters backend-side (planning.admin_config's own
  // docstring covers why "module" fields need a different apply mechanism), surfaced
  // here mostly for debugging/completeness, not branched on in the UI.
  target?: "constants" | "module";
  // Hardcoded default - never changes without a code deploy. For "constants" fields,
  // read fresh off a new BusinessConstants() every request; for "module" fields, this is
  // the one place the true original default is recorded at all (the module itself may
  // already be running with a prior override applied - see planning.admin_config).
  default: number;
  // Effective value used by the next plan generation: the override if one exists,
  // else `default`. This is what the panel should show in the input.
  value: number;
  // True when `value` differs from `default` because an admin override exists -
  // distinct from a locally-edited-but-not-yet-saved value, which the panel tracks
  // itself (see AdminView's pendingEdits state).
  overridden: boolean;
}

export interface AdminConfigGroup {
  Group: string;
  Fields: AdminConfigField[];
}

export interface AdminConfigResponse {
  Groups: AdminConfigGroup[];
  Updated_At: string | null;
  Updated_By: string;
  // Only present on a POST response - {key: error_message} for any rejected changes
  // (a partial apply, not all-or-nothing - see admin_config.apply_overrides's own
  // docstring). Absent (not {}) on a plain GET.
  Errors?: Record<string, string>;
}
