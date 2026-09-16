import { apiGet, apiGetPaginated, apiPost, apiPostForm, apiUrl } from "@/shared/api/client";
import type { AdminConfigResponse } from "@/shared/types/adminConfig";
import type { RoutingScopeOverride, RoutingOverrideScopeType } from "@/shared/types/routingOverrides";
import type {
  DCSelectionState,
  DCSelectionRules,
  DCSelectionSearchResult,
  DCSelectionFilterMode,
  DCSelectionUploadResult,
  DCSelectionUploadMode,
} from "@/shared/types/dcSelection";
import type {
  StateOption,
  NodeOption,
  DistrictOption,
  BlockOption,
  ManagerDirectoryEntry,
  SEDirectoryEntry,
  PaginatedDCResponse,
} from "@/shared/types/directory";
import type {
  PlanRunResponse,
  TuffResponse,
  NormalizationResult,
} from "@/shared/types/planRun";
import type {
  RoutesResponse,
  RoutePlanType,
  SelectRoutePlanResponse,
  AcceptRoutePlanResponse,
  RejectRoutePlanResponse,
  EditRouteStopResponse,
} from "@/shared/types/routing";
import type {
  PitchResponse,
  HeadcountResponse,
  StreakEntry,
  CompletionStatsEntry,
  ScheduledScopeEntry,
  RunsListEntry,
} from "@/shared/types/feedback";
import type { RoutingPlanChoice, ScopePathSegment } from "@/shared/types/scope";
import type { DCCardResponse } from "@/shared/types/dcCard";
import type { AuthenticatedUser } from "@/features/rbac/types";
import type { UserRow, CreateUserPayload } from "@/shared/types/users";
import type { TrackingResponse } from "@/shared/types/tracking";

// ---------------------------------------------------------------------------
// §6 Directory / Lookup endpoints - populate every dropdown/typeahead. Nine
// endpoints; the frontend should drive option lists from these, never hardcode.
// ---------------------------------------------------------------------------
export const directoryApi = {
  states: () => apiGet<StateOption[]>("/directory/states/"),

  nodes: (params?: { state?: string }) =>
    apiGet<NodeOption[]>("/directory/nodes/", params),

  // state is optional server-side (planning.directory.list_districts) - omit it to get
  // every District network-wide, e.g. for RoutingOverridesPanel's scope-value picker,
  // which isn't nested under a state selection the way the ScopeSelector cascade is.
  districts: (params?: { state?: string }) =>
    apiGet<DistrictOption[]>("/directory/districts/", params),

  blocks: (params: { state: string; district: string }) =>
    apiGet<BlockOption[]>("/directory/blocks/", params),

  zbms: () => apiGet<ManagerDirectoryEntry[]>("/directory/zbms/"),

  rbms: () => apiGet<ManagerDirectoryEntry[]>("/directory/rbms/"),

  abms: () => apiGet<ManagerDirectoryEntry[]>("/directory/abms/"),

  ses: (params?: { state?: string; node?: string }) =>
    apiGet<SEDirectoryEntry[]>("/directory/ses/", params),

  dcs: (params?: {
    state?: string;
    node?: string;
    se?: string;
    limit?: number;
    offset?: number;
  }) => apiGet<PaginatedDCResponse>("/directory/dcs/", params),
};

// ---------------------------------------------------------------------------
// §7 Scope / SE Daily Task endpoints - seven endpoints, one per scope type,
// all sharing the PlanRun response shape. scope_value semantics vary per type
// (SE email, ABM/RBM employee code, Node/Block/District/State name).
// ---------------------------------------------------------------------------
export const scopeApi = {
  // Moved from apiGet to apiPost 2026-09-16 (architecture audit, round 2) -- this
  // endpoint creates a new PlanRun + DailyTask rows + triggers live Pitching/DC Card
  // generation on every call, so it was never actually safe/idempotent despite being a
  // GET. Safe for React Query's queryFn here (see useScopePlanRun.ts's own comment) --
  // queryFn is transport-agnostic, so this doesn't change caching/dedup behavior, only
  // the wire method.
  get: (
    segment: ScopePathSegment,
    scopeValue: string,
    params?: { date?: string; routing_plan?: RoutingPlanChoice; rotation?: boolean },
  ) =>
    apiPost<PlanRunResponse>(
      `/${segment}/${encodeURIComponent(scopeValue)}/`,
      params ?? {},
    ),
};

// ---------------------------------------------------------------------------
// §9 Normalization + combined TUFF fetch.
// ---------------------------------------------------------------------------
export const normalizationApi = {
  // Both moved from apiGet to apiPost 2026-09-16 (architecture audit, round 2) -- these
  // trigger live Redshift pulls (normalize) or normalization + full plan generation
  // combined (tuff, the heaviest mutation in this whole API) -- neither was ever
  // actually safe/idempotent despite being GET.
  normalize: (params: { date: string; force?: boolean }) =>
    apiPost<NormalizationResult>("/normalize/", {
      date: params.date,
      force: params.force,
    }),

  // scope_type is UPPERCASE here - deliberately distinct from the lowercase
  // ScopePathSegment used by scopeApi.get above (§9 note).
  tuff: (
    scopeType: "SE" | "ABM" | "RBM" | "NODE" | "BLOCK" | "DISTRICT" | "STATE",
    scopeValue: string,
    params?: {
      date?: string;
      force_normalization?: boolean;
      skip_normalization?: boolean;
      routing_plan?: RoutingPlanChoice;
      rotation?: boolean;
    },
  ) =>
    apiPost<TuffResponse>(
      `/tuff/${scopeType}/${encodeURIComponent(scopeValue)}/`,
      params ?? {},
    ),
};

// ---------------------------------------------------------------------------
// §10 Routing Agent.
// ---------------------------------------------------------------------------
export const routingApi = {
  list: (se: string, planDate: string, params?: { plan_run?: string }) =>
    apiGet<RoutesResponse>(
      `/routes/${encodeURIComponent(se)}/${encodeURIComponent(planDate)}/`,
      params,
    ),

  // Select/Accept/Reject/add-DC/remove-DC all mutate PlanRun/RoutePlan/DailyTask/
  // PitchScript/DCCard state - moved from apiGet to apiPost 2026-09-16 (architecture
  // audit: GET is supposed to be safe/idempotent; browser prefetch, a proxy cache, or
  // React Query's own refetch-on-window-focus could otherwise trigger a real mutation
  // as a side effect of just viewing a link). See planning/views.py's matching views
  // for the server-side half of this change.
  select: (
    se: string,
    planDate: string,
    planType: RoutePlanType,
    params?: { plan_run?: string },
  ) =>
    apiPost<SelectRoutePlanResponse>(
      `/routes/${encodeURIComponent(se)}/${encodeURIComponent(planDate)}/select/${planType}/`,
      params ?? {},
    ),

  // SE's own Accept/Reject/add-DC/remove-DC actions (added 2026-09-15, explicit user
  // request - "In se have the right ... accept and reject cta ... add the dc ... or
  // wants to delete"). See planning/routing.py accept_route_plan/reject_route_plan/
  // edit_route_stops for the real validation/recompute behind each of these.
  accept: (
    se: string,
    planDate: string,
    planType: RoutePlanType,
    params?: { plan_run?: string; actor?: string },
  ) =>
    apiPost<AcceptRoutePlanResponse>(
      `/routes/${encodeURIComponent(se)}/${encodeURIComponent(planDate)}/accept/${planType}/`,
      params ?? {},
    ),

  reject: (se: string, planDate: string, params?: { plan_run?: string; actor?: string }) =>
    apiPost<RejectRoutePlanResponse>(
      `/routes/${encodeURIComponent(se)}/${encodeURIComponent(planDate)}/reject/`,
      params ?? {},
    ),

  addStop: (
    se: string,
    planDate: string,
    planType: RoutePlanType,
    dcId: string,
    params?: { plan_run?: string },
  ) =>
    apiPost<EditRouteStopResponse>(
      `/routes/${encodeURIComponent(se)}/${encodeURIComponent(planDate)}/${planType}/stops/add/`,
      { ...params, dc_id: dcId },
    ),

  removeStop: (
    se: string,
    planDate: string,
    planType: RoutePlanType,
    dcId: string,
    params?: { plan_run?: string },
  ) =>
    apiPost<EditRouteStopResponse>(
      `/routes/${encodeURIComponent(se)}/${encodeURIComponent(planDate)}/${planType}/stops/remove/`,
      { ...params, dc_id: dcId },
    ),
};

// ---------------------------------------------------------------------------
// §11 Pitching Agent. 404 means "no pitch for this task" (e.g. Farmer Meeting) -
// callers should catch ApiError with status 404 and treat it as an empty state,
// not a failed request.
// ---------------------------------------------------------------------------
export const pitchingApi = {
  get: (dailyTaskId: number) => apiGet<PitchResponse>(`/pitch/${dailyTaskId}/`),
};

// ---------------------------------------------------------------------------
// DC Card (Preface) / "Dehaat Center Ko Jaano" - a second, complementary pre-pitch
// briefing (planning/dc_card.py), shown before the Pitching Agent's own Ask/Tell/Wish.
// Same 404-as-empty-state contract as pitching for Farmer Meeting tasks.
// ---------------------------------------------------------------------------
export const dcCardApi = {
  get: (dailyTaskId: number) => apiGet<DCCardResponse>(`/dc-card/${dailyTaskId}/`),
};

// ---------------------------------------------------------------------------
// §12 Headcount Bifurcation (Org Overview).
// ---------------------------------------------------------------------------
export const headcountApi = {
  get: (params?: { list?: boolean }) =>
    apiGet<HeadcountResponse>("/headcount/", params),
};

// ---------------------------------------------------------------------------
// §13 Feedback Loop / Ops.
// ---------------------------------------------------------------------------
export const feedbackOpsApi = {
  // limit defaults to 500, capped at 2000 server-side (ordered worst-first by
  // Consecutive_Misses) - see PaginatedResult.totalCount for whether this was truncated.
  streaks: (params?: { se?: string; dc?: string; min_misses?: number; limit?: number; offset?: number }) =>
    apiGetPaginated<StreakEntry>("/streaks/", params),

  // limit defaults to 500, capped at 2000 server-side.
  completionStats: (params: { se?: string; objective?: string; limit?: number; offset?: number }) =>
    apiGetPaginated<CompletionStatsEntry>("/completion-stats/", params),

  scheduledScopes: (params?: { active?: boolean; scope_type?: string }) =>
    apiGet<ScheduledScopeEntry[]>("/scheduled-scopes/", params),
};

// ---------------------------------------------------------------------------
// §14 Past PlanRuns (Run History).
// ---------------------------------------------------------------------------
export const runsApi = {
  // limit defaults to 50, capped at 500 server-side. plan_date added 2026-09-10.
  list: (params?: {
    scope_type?: string;
    scope_value?: string;
    status?: string;
    plan_date?: string;
    limit?: number;
    offset?: number;
  }) => apiGetPaginated<RunsListEntry>("/runs/", params),

  get: (planRunId: string) =>
    apiGet<PlanRunResponse>(`/runs/${encodeURIComponent(planRunId)}/`),

  // Added 2026-09-10, explicit user request - "system run plan means it will generate
  // the plan for all se with eligible dc". Fires a detached background subprocess
  // server-side (planning/management/commands/run_all_states_tuff.py) covering every
  // STATE - returns immediately; new PlanRuns simply appear via `list` above as each
  // state finishes, there is no separate progress endpoint by design.
  generateAllStates: (planDate?: string, actor?: string) =>
    apiPost<{ started: boolean; log_file: string; message: string }>("/admin/generate-all-states/", {
      plan_date: planDate || undefined,
      actor,
    }),
};

// ---------------------------------------------------------------------------
// Real auth (added 2026-09-14, planning/auth_views.py) - login/logout/session-restore/
// self-service password change. A deliberately separate wire convention (camelCase,
// matching AuthenticatedUser exactly) from the rest of this file's PascalCase admin-
// facing API family - see that type's own note. Consumed by features/auth/AuthContext,
// not called directly by feature panels the way the rest of this file is.
// ---------------------------------------------------------------------------
export const authApi = {
  login: (username: string, password: string) =>
    apiPost<AuthenticatedUser>("/auth/login/", { username, password }),

  logout: () => apiPost<Record<string, never>>("/auth/logout/", {}),

  // 401 (ApiError) means "no session" - an expected, routine outcome on every
  // logged-out page load, not something the caller should treat as a failure.
  me: () => apiGet<AuthenticatedUser>("/auth/me/"),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiPost<Record<string, never>>("/auth/change-password/", {
      current_password: currentPassword,
      new_password: newPassword,
    }),
};

// ---------------------------------------------------------------------------
// Admin Panel user management (added 2026-09-14, planning/auth_views.py) - the one
// part of the admin surface that actually requires an authenticated ADMIN session
// server-side (require_admin) - every other /admin/* endpoint below still doesn't,
// see this session's own scoping note in auth_views.py's module docstring.
// ---------------------------------------------------------------------------
export const usersApi = {
  list: () => apiGet<UserRow[]>("/admin/users/"),

  create: (payload: CreateUserPayload) => apiPost<UserRow>("/admin/users/create/", payload),

  setActive: (id: number, isActive: boolean) =>
    apiPost<UserRow>(`/admin/users/${id}/set-active/`, { is_active: isActive }),

  resetPassword: (id: number, newPassword: string) =>
    apiPost<Record<string, never>>(`/admin/users/${id}/reset-password/`, { new_password: newPassword }),
};

// ---------------------------------------------------------------------------
// Admin Control Panel (added 2026-09-07) - live-editable BusinessConstants overrides.
// ---------------------------------------------------------------------------
export const adminApi = {
  getConfig: () => apiGet<AdminConfigResponse>("/admin/config/"),

  // `changes` - {field_key: new_value}; `reset` - field_keys to revert to their
  // hardcoded default. Either can be empty/omitted; both are applied in one request
  // (reset first, then changes, per planning/views.py's admin_pipeline_config). value is
  // a string for a "choice" field (e.g. Plan C's decision style), a number otherwise.
  updateConfig: (changes: Record<string, number | string>, reset: string[] = [], actor?: string) =>
    apiPost<AdminConfigResponse>("/admin/config/", { changes, reset, actor }),
};

// Tracking dashboard (added 2026-09-16, planning/tracking.py) - one read-only
// aggregation over what the pipeline already persists, windowed by generation time.
export const trackingApi = {
  get: (days: number) => apiGet<TrackingResponse>(`/admin/tracking/?days=${days}`),
};

// ---------------------------------------------------------------------------
// DC Selection (added 2026-09-08) - replaces the Excel Top DC list with an
// admin-configurable AND/OR rule over dc_datamart + an uploadable DC_RAnk.csv,
// plus manual include/exclude. See planning/dc_selection.py's module docstring.
// ---------------------------------------------------------------------------
export const dcSelectionApi = {
  getState: () => apiGet<DCSelectionState>("/admin/dc-selection/"),

  // Read-only - never persists. Explicit user request ("reflection of count before save
  // rule"): computes Selected_Count for an in-progress, not-yet-saved rule edit so the
  // panel can show a live count while checkboxes are still being toggled, instead of
  // only after Save rule. upload_mode omitted uses whatever mode is currently stored.
  previewSelection: (rules: DCSelectionRules, uploadMode?: DCSelectionUploadMode) =>
    apiPost<{ Selected_Count: number | null; Universe_Size: number; Live_Query_Ok: boolean }>(
      "/admin/dc-selection/preview/",
      { rules, upload_mode: uploadMode },
    ),

  // Any subset of the four; omit a key to leave it untouched server-side. A rank_range
  // rule matching zero DCs is rejected by the backend (400) - see update_selection's
  // own docstring - so callers should catch ApiError and surface `body.error`.
  update: (
    changes: {
      rules?: DCSelectionRules;
      manual_includes?: string[];
      manual_excludes?: string[];
      upload_mode?: DCSelectionUploadMode;
    },
    actor?: string,
  ) => apiPost<DCSelectionState>("/admin/dc-selection/", { ...changes, actor }),

  search: (params?: { q?: string; limit?: number; offset?: number; filter_mode?: DCSelectionFilterMode }) =>
    apiGet<DCSelectionSearchResult>("/admin/dc-selection/search/", params),

  uploadRankCsv: (file: File, actor?: string) => {
    const form = new FormData();
    form.set("file", file);
    if (actor) form.set("actor", actor);
    return apiPostForm<DCSelectionState>("/admin/dc-selection/upload-rank-csv/", form);
  },

  // Selected DC List uploader - REWRITTEN 2026-09-08 per direct spec: dc_datamart is
  // checked first (the gate - a genuinely-absent ID is rejected, not added to Manual
  // Includes), DC_RAnk.csv second for Rank/Cohort (soft - missing there doesn't
  // reject). `uploadMode` is optional - set alongside the file per direct instruction
  // ("the mode is chosen at upload time"); omit to leave whatever mode is already
  // stored untouched.
  uploadSelectedDcs: (file: File, actor?: string, uploadMode?: DCSelectionUploadMode) => {
    const form = new FormData();
    form.set("file", file);
    if (actor) form.set("actor", actor);
    if (uploadMode) form.set("upload_mode", uploadMode);
    return apiPostForm<DCSelectionUploadResult>("/admin/dc-selection/upload-selected-dcs/", form);
  },

  // Plain hrefs (real browser GET + Content-Disposition: attachment), not apiGet calls -
  // these download a sample file, they don't return JSON.
  sampleRankCsvUrl: () => apiUrl("/admin/dc-selection/sample-rank-csv/"),
  sampleSelectedDcsCsvUrl: () => apiUrl("/admin/dc-selection/sample-selected-dcs-csv/"),
};

// ---------------------------------------------------------------------------
// Routing per-scope overrides (added 2026-09-11) - NODE/STATE-only, most-specific-wins
// ceiling overrides layered on top of the Routing group's network-wide values.
// ---------------------------------------------------------------------------
export const routingOverridesApi = {
  list: () => apiGet<RoutingScopeOverride[]>("/admin/routing-overrides/"),

  // Any subset of the 4 ceiling fields; a field set to `null` clears that override
  // (falls through to a less-specific scope/the global default), an omitted field is
  // left untouched.
  upsert: (
    scopeType: RoutingOverrideScopeType,
    scopeValue: string,
    fields: Partial<Record<
      "r1_2_max_travel_minutes" | "plan_a_max_round_trip_distance_km" | "plan_b_max_daily_distance_km" | "plan_b_max_daily_travel_minutes",
      number | null
    >>,
    actor?: string,
  ) =>
    apiPost<RoutingScopeOverride>("/admin/routing-overrides/", {
      scope_type: scopeType,
      scope_value: scopeValue,
      ...fields,
      actor,
    }),

  remove: (scopeType: RoutingOverrideScopeType, scopeValue: string) =>
    apiPost<{ deleted: boolean }>("/admin/routing-overrides/delete/", { scope_type: scopeType, scope_value: scopeValue }),
};
