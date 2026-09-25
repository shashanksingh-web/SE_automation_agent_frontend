// Ground truth from SE_automation_server/planning/directory.py - snake_case, not the
// PascalCase the spec doc used. DC_Master_Normalized.json / Geo_Mapping_Normalized.json
// are the two source tables (see that module's docstring for which endpoint reads which).

export interface StateOption {
  state: string;
  node_count: number;
  se_count: number;
  dc_count: number;
}

export interface NodeOption {
  node: string;
  state: string;
  se_count: number;
  dc_count: number;
}

export interface DistrictOption {
  district: string;
  state: string;
  block_count: number;
  dc_count: number;
}

export interface BlockOption {
  block: string;
  district: string;
  state: string;
  dc_count: number;
}

// Shared shape for zbms/rbms/abms (planning.directory._list_role) - name/email can be
// null when a Geo_Mapping row has a code but no matching name/email data.
export interface ManagerDirectoryEntry {
  code: string;
  name: string | null;
  email: string | null;
  states: string[];
  node_count: number;
  dc_count: number;
}

// No SE_Name/display-name field exists anywhere in this data model - se_email is the
// only identifier with a name. emp_id_se (added 2026-09-14) is a real employee code
// joined in from Geo_Mapping_Normalized.json by email - null (not fabricated) for the
// ~18% of SEs with no matching Geo_Mapping row (confirmed live: 373/453 have one).
// There is still no name to auto-fill for an SE even once emp_id_se is picked - don't
// assume one exists just because the code does.
export interface SEDirectoryEntry {
  se_email: string;
  emp_id_se: string | null;
  states: string[];
  nodes: string[];
  dc_count: number;
}

export interface DCDirectoryEntry {
  dc_id: string;
  dc_name: string;
  node: string;
  state: string;
  assigned_se_email: string | null;
  rank: number | null;
  cohort: string | null;
  total_score: number | null;
  total_score_unscored: boolean | null;
  latitude: number | null;
  longitude: number | null;
  dc_status: string | null;
  in_scope_flag: boolean | null;
}

export interface PaginatedDCResponse {
  total: number;
  limit: number;
  offset: number;
  returned: number;
  dcs: DCDirectoryEntry[];
}
