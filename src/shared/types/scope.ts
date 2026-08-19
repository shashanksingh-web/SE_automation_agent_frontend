// Two parallel trees, both bottoming out at the SE (spec §7):
//   Geographic: (ZBM ->) State -> District -> Block -> Node
//   Org:        RBM -> ABM -> SE
// ZBM ("State Head") is a directory-only rollup: no direct /zbm/<code>/ plan endpoint exists.
export type ScopeType =
  | "SE"
  | "ABM"
  | "RBM"
  | "NODE"
  | "BLOCK"
  | "DISTRICT"
  | "STATE"
  | "ZBM";

// Lowercase path segment used by the 7 plain scope endpoints (§7).
// Note /tuff/<scope_type>/ (§9) uses the UPPERCASE ScopeType instead - the two are not
// interchangeable, keep them as distinct types so a mismatch is a compile error.
export type ScopePathSegment =
  | "se"
  | "abm"
  | "rbm"
  | "node"
  | "block"
  | "district"
  | "state";

export const SCOPE_TYPE_TO_PATH_SEGMENT: Record<
  Exclude<ScopeType, "ZBM">,
  ScopePathSegment
> = {
  SE: "se",
  ABM: "abm",
  RBM: "rbm",
  NODE: "node",
  BLOCK: "block",
  DISTRICT: "district",
  STATE: "state",
};

export type ViewType =
  | "overall"
  | "zbm"
  | "state"
  | "rbm"
  | "abm"
  | "se"
  | "ops"
  | "district"
  | "block"
  | "node";

export type DateSelection =
  | { type: "today" }
  | { type: "tomorrow" }
  | { type: "custom"; date: string }; // YYYY-MM-DD

export function dateSelectionToQueryParam(
  selection: DateSelection,
): string | undefined {
  if (selection.type === "custom") return selection.date;
  if (selection.type === "today") return undefined; // API defaults to today when omitted
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function dateSelectionCacheKey(selection: DateSelection): string {
  return selection.type === "custom"
    ? `custom:${selection.date}`
    : selection.type;
}
