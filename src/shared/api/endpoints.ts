import { apiGet, apiGetPaginated, apiPost, apiPostForm, apiUrl } from "@/shared/api/client";
import type { AdminConfigResponse } from "@/shared/types/adminConfig";
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
import type { RoutesResponse, RoutePlanType, SelectRoutePlanResponse } from "@/shared/types/routing";
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

// ---------------------------------------------------------------------------
// §6 Directory / Lookup endpoints - populate every dropdown/typeahead. Nine
// endpoints; the frontend should drive option lists from these, never hardcode.
// ---------------------------------------------------------------------------
export const directoryApi = {
  states: () => apiGet<StateOption[]>("/directory/states/"),

  nodes: (params?: { state?: string }) =>
    apiGet<NodeOption[]>("/directory/nodes/", params),

  districts: (params: { state: string }) =>
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
  get: (
    segment: ScopePathSegment,
    scopeValue: string,
    params?: { date?: string; routing_plan?: RoutingPlanChoice; rotation?: boolean },
  ) =>
    apiGet<PlanRunResponse>(
      `/${segment}/${encodeURIComponent(scopeValue)}/`,
      params,
    ),
};

// ---------------------------------------------------------------------------
// §9 Normalization + combined TUFF fetch.
// ---------------------------------------------------------------------------
export const normalizationApi = {
  normalize: (params: { date: string; force?: boolean }) =>
    apiGet<NormalizationResult>("/normalize/", {
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
    apiGet<TuffResponse>(
      `/tuff/${scopeType}/${encodeURIComponent(scopeValue)}/`,
      params,
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

  select: (
    se: string,
    planDate: string,
    planType: RoutePlanType,
    params?: { plan_run?: string },
  ) =>
    apiGet<SelectRoutePlanResponse>(
      `/routes/${encodeURIComponent(se)}/${encodeURIComponent(planDate)}/select/${planType}/`,
      params,
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
  // limit defaults to 50, capped at 500 server-side.
  list: (params?: { scope_type?: string; scope_value?: string; status?: string; limit?: number; offset?: number }) =>
    apiGetPaginated<RunsListEntry>("/runs/", params),

  get: (planRunId: string) =>
    apiGet<PlanRunResponse>(`/runs/${encodeURIComponent(planRunId)}/`),
};

// ---------------------------------------------------------------------------
// Admin Control Panel (added 2026-09-07) - live-editable BusinessConstants overrides.
// ---------------------------------------------------------------------------
export const adminApi = {
  getConfig: () => apiGet<AdminConfigResponse>("/admin/config/"),

  // `changes` - {field_key: new_value}; `reset` - field_keys to revert to their
  // hardcoded default. Either can be empty/omitted; both are applied in one request
  // (reset first, then changes, per planning/views.py's admin_pipeline_config).
  updateConfig: (changes: Record<string, number>, reset: string[] = [], actor?: string) =>
    apiPost<AdminConfigResponse>("/admin/config/", { changes, reset, actor }),
};

// ---------------------------------------------------------------------------
// DC Selection (added 2026-09-08) - replaces the Excel Top DC list with an
// admin-configurable AND/OR rule over dc_datamart + an uploadable DC_RAnk.csv,
// plus manual include/exclude. See planning/dc_selection.py's module docstring.
// ---------------------------------------------------------------------------
export const dcSelectionApi = {
  getState: () => apiGet<DCSelectionState>("/admin/dc-selection/"),

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
