import type { ViewType } from "@/shared/types/scope";
import type { AppRole, AuthenticatedUser, RoleResolution } from "@/features/rbac/types";

// RBAC maps the authenticated user's role to a default view type + scope value,
// and to the set of other view types they may switch into (spec §4). None of
// this is enforced server-side - the planning API takes no auth token - so this
// module is the only gate preventing e.g. an SE from typing another SE's email
// into a free-text scope field.
export function resolveDefaultView(user: AuthenticatedUser): RoleResolution {
  switch (user.role) {
    case "SE":
      return {
        defaultView: { type: "se", scopeValue: user.email },
        allowedViewTypes: ["se"],
      };
    case "ABM":
      return {
        defaultView: { type: "abm", scopeValue: user.employeeCode ?? "" },
        // An ABM may drill into their own SEs, not switch into another ABM's
        // or RBM's view (§4).
        allowedViewTypes: ["abm", "se"],
      };
    case "RBM":
      return {
        defaultView: { type: "rbm", scopeValue: user.employeeCode ?? "" },
        allowedViewTypes: ["rbm", "abm", "se"],
      };
    case "ZBM":
      // Covered states are resolved separately from GET /directory/zbms/ once
      // the directory query has loaded (see useResolveZbmCoverage) - scopeValue
      // here is the ZBM's own code, used to look up their coverage entry.
      return {
        defaultView: { type: "zbm", scopeValue: user.employeeCode ?? user.email },
        allowedViewTypes: ["zbm", "state", "district", "block", "node", "rbm", "abm", "se"],
      };
    case "NATIONAL":
      return {
        defaultView: { type: "overall", scopeValue: "" },
        allowedViewTypes: [
          "overall",
          "zbm",
          "state",
          "district",
          "block",
          "node",
          "rbm",
          "abm",
          "se",
        ],
      };
    case "ADMIN":
      return {
        defaultView: { type: "overall", scopeValue: "" },
        allowedViewTypes: [
          "overall",
          "ops",
          // Admin Control Panel (added 2026-09-07) - live BusinessConstants overrides,
          // ADMIN role only.
          "admin",
          // System Plan Runs (added 2026-09-10) - ADMIN role only, same as "admin" above.
          "system-plan-runs",
          // Tracking dashboard (added 2026-09-16) - ADMIN role only.
          "tracking",
          "zbm",
          "state",
          "district",
          "block",
          "node",
          "rbm",
          "abm",
          "se",
        ],
      };
    default:
      return {
        defaultView: { type: "se", scopeValue: user.email },
        allowedViewTypes: ["se"],
      };
  }
}

export function canSwitchToView(role: AppRole, target: ViewType): boolean {
  const { allowedViewTypes } = resolveDefaultView({
    role,
    email: "",
    employeeCode: "",
    name: "",
  });
  return allowedViewTypes.includes(target);
}

// Enforce in the Scope Selector UI (not just routing) that a role can't query
// scope values belonging to someone else (§4). "own scope" roles must have
// their scope value locked to the identity value; free-text entry is disabled.
const LOCKED_SCOPE_ROLES: AppRole[] = ["SE", "ABM", "RBM"];

export function isScopeValueLockedToSelf(role: AppRole): boolean {
  return LOCKED_SCOPE_ROLES.includes(role);
}

export function ownScopeValue(user: AuthenticatedUser): string {
  switch (user.role) {
    case "SE":
      return user.email;
    case "ABM":
    case "RBM":
      return user.employeeCode ?? "";
    default:
      return "";
  }
}
