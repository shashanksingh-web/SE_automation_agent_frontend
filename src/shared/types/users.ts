// User management (planning/auth_views.py, added 2026-09-14) - Admin Panel's "Users"
// tab. PascalCase like the rest of the admin-facing API family (unlike
// AuthenticatedUser in features/rbac/types.ts, which is camelCase on purpose - see that
// type's own note on why /auth/* is a deliberately separate wire convention from the
// rest of this app).
import type { AppRole } from "@/features/rbac/types";

export interface UserRow {
  Id: number;
  Username: string;
  Name: string;
  // null only if a UserProfile is somehow missing (e.g. an account created outside
  // admin_users_create, like manage.py createsuperuser) - never happens for anything
  // created through this panel.
  Role: AppRole | null;
  // SE's own scope_value - "" for every other role.
  Email: string;
  // ABM/RBM/ZBM's own scope_value - "" for every other role.
  Employee_Code: string;
  Is_Active: boolean;
  Date_Joined: string;
  Last_Login: string | null;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  name: string;
  role: AppRole;
  email?: string;
  employee_code?: string;
}
