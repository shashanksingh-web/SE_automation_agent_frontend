import type { ViewType } from "@/shared/types/scope";

// App-shell roles. This is a frontend-only concept - the planning API itself has
// no notion of roles or auth (spec §1, §4). Extend this list as the real login
// system's role names are known.
export type AppRole = "SE" | "ABM" | "RBM" | "ZBM" | "NATIONAL" | "ADMIN";

export interface AuthenticatedUser {
  role: AppRole;
  email: string;
  employeeCode: string | null; // required for ABM/RBM (§4)
  name: string;
}

export interface RoleResolution {
  defaultView: { type: ViewType; scopeValue: string };
  allowedViewTypes: ViewType[];
}
