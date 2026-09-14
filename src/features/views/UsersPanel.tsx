import { useMemo, useState } from "react";
import { Loader2, Plus, KeyRound } from "lucide-react";
import { useUsers, useCreateUser, useSetUserActive, useResetUserPassword } from "@/shared/api/hooks/useUsers";
import { useSEs, useAbms, useRbms, useZbms } from "@/shared/api/hooks/useDirectory";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import { SingleSelectCombobox, type SingleSelectOption } from "@/shared/components/SingleSelectCombobox";
import type { AppRole } from "@/features/rbac/types";
import type { UserRow } from "@/shared/types/users";
import type { ManagerDirectoryEntry } from "@/shared/types/directory";
import { ApiError } from "@/shared/api/client";

const ROLES: AppRole[] = ["SE", "ABM", "RBM", "ZBM", "NATIONAL", "ADMIN"];

// Roles with a real, directory-backed Employee ID to pick from (added 2026-09-14,
// explicit user request - "Username will be Employee ID (dropdown) Name automatically
// fetch"). NATIONAL/ADMIN have no org-hierarchy row anywhere in this data model (see
// planning/directory.py) - free-text Username/Name stays the only option for those two,
// not an oversight.
const DIRECTORY_BACKED_ROLES: AppRole[] = ["SE", "ABM", "RBM", "ZBM"];

const EMPTY_FORM = { username: "", password: "", name: "", role: "SE" as AppRole, email: "", employee_code: "" };

function managerOptions(entries: ManagerDirectoryEntry[] | undefined): SingleSelectOption[] {
  return (entries ?? []).map((e) => ({ value: e.code, label: e.code, sublabel: e.name ?? "no name on file" }));
}

// Admin Panel "Users" tab (added 2026-09-14, explicit user request - "in admin panel
// provide user creation and password creation active and deactivate the user and
// change the password with backend capability"). Every write here goes through
// planning/auth_views.py's require_admin-gated endpoints - the one part of the admin
// surface that's actually authenticated server-side (see that module's own docstring).
export function UsersPanel() {
  const { data, isLoading, isError } = useUsers();
  const createUser = useCreateUser();

  const [form, setForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  // Directory sources for the Employee ID pickers below - only fetched for the role
  // that's actually selected would be nicer, but these 4 lists are all small/cheap
  // (React Query dedupes/caches regardless of which tab-switch triggered them first).
  const { data: ses, isLoading: sesLoading } = useSEs();
  const { data: abms, isLoading: abmsLoading } = useAbms();
  const { data: rbms, isLoading: rbmsLoading } = useRbms();
  const { data: zbms, isLoading: zbmsLoading } = useZbms();

  // SEs have a real Employee ID (emp_id_se) but - unlike ABM/RBM/ZBM - no name field
  // exists anywhere in this data model (see SEDirectoryEntry's own note), so only the
  // ID+email half of "pick ID -> auto-fill Name" is possible for this role. Filtered to
  // entries that actually have one - an SE with none on file (confirmed live: ~18% of
  // them) genuinely can't be assigned a username this way.
  const seOptions = useMemo<SingleSelectOption[]>(
    () =>
      (ses ?? [])
        .filter((s) => s.emp_id_se)
        .map((s) => ({ value: s.emp_id_se!, label: s.emp_id_se!, sublabel: s.se_email })),
    [ses],
  );
  const seEmailByEmpId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of ses ?? []) if (s.emp_id_se) map.set(s.emp_id_se, s.se_email);
    return map;
  }, [ses]);
  const abmOptions = useMemo(() => managerOptions(abms), [abms]);
  const rbmOptions = useMemo(() => managerOptions(rbms), [rbms]);
  const zbmOptions = useMemo(() => managerOptions(zbms), [zbms]);
  const nameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of [...(abms ?? []), ...(rbms ?? []), ...(zbms ?? [])]) if (e.name) map.set(e.code, e.name);
    return map;
  }, [abms, rbms, zbms]);

  const { employeeOptions, employeeOptionsLoading } =
    form.role === "SE"
      ? { employeeOptions: seOptions, employeeOptionsLoading: sesLoading }
      : form.role === "ABM"
        ? { employeeOptions: abmOptions, employeeOptionsLoading: abmsLoading }
        : form.role === "RBM"
          ? { employeeOptions: rbmOptions, employeeOptionsLoading: rbmsLoading }
          : { employeeOptions: zbmOptions, employeeOptionsLoading: zbmsLoading };

  // Switching Role mid-edit invalidates whatever Employee ID was already picked (it
  // belongs to the PREVIOUS role's own list) - reset the derived fields rather than
  // leaving a stale username/name/email/employee_code combination from a different role.
  const handleRoleChange = (role: AppRole) => {
    setForm((f) => ({ ...f, role, username: "", name: "", email: "", employee_code: "" }));
  };

  // Picking an Employee ID auto-fills Username (= the ID itself) and, where the data
  // supports it, Name/Email/Employee code - see this component's own note on why SE
  // never gets a Name here (no name field exists for SE anywhere in this data model).
  const handlePickEmployeeId = (id: string) => {
    if (form.role === "SE") {
      setForm((f) => ({ ...f, username: id, email: seEmailByEmpId.get(id) ?? f.email }));
    } else {
      setForm((f) => ({ ...f, username: id, name: nameByCode.get(id) ?? "", employee_code: id }));
    }
  };

  const handleCreate = () => {
    setCreateError(null);
    createUser.mutate(
      { ...form },
      {
        onSuccess: () => setForm(EMPTY_FORM),
        onError: (e) => setCreateError(e instanceof ApiError ? e.message : "Could not create user."),
      },
    );
  };

  const canCreate = form.username.trim() && form.password.trim();
  const isDirectoryBacked = DIRECTORY_BACKED_ROLES.includes(form.role);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Users</CardTitle>
        <CardDescription>
          Create accounts, set who's active, and reset passwords. Role determines which views an account can
          reach after signing in (features/rbac/rbac.ts) - it isn't chosen at login anymore.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={form.role} onValueChange={(v) => handleRoleChange(v as AppRole)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Username{isDirectoryBacked && " (Employee ID)"}</Label>
            {isDirectoryBacked ? (
              <SingleSelectCombobox
                className="w-48"
                options={employeeOptions}
                value={form.username}
                onChange={handlePickEmployeeId}
                loading={employeeOptionsLoading}
                placeholder="Select employee ID..."
              />
            ) : (
              <Input
                className="w-36"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              className="w-36"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              Name{form.role !== "SE" && isDirectoryBacked ? " (auto-filled)" : ""}
            </Label>
            <Input
              className="w-36"
              value={form.name}
              disabled={form.role !== "SE" && isDirectoryBacked}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={form.role === "SE" ? "No name on file - enter manually" : undefined}
            />
          </div>
          {form.role === "SE" && (
            <div className="space-y-1">
              <Label className="text-xs">Email (scope value)</Label>
              <Input
                type="email"
                className="w-44"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          )}
          <Button size="sm" onClick={handleCreate} disabled={!canCreate || createUser.isPending}>
            {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create user
          </Button>
        </div>
        {createError && <div className="text-xs text-destructive">{createError}</div>}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
          </div>
        )}
        {isError && <div className="text-sm text-destructive">Could not load users.</div>}

        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Scope value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <UserTableRow key={row.Id} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.length === 0 && <p className="text-sm text-muted-foreground">No users yet.</p>}
      </CardContent>
    </Card>
  );
}

function UserTableRow({ row }: { row: UserRow }) {
  const setActive = useSetUserActive();
  const resetPassword = useResetUserPassword();

  const [activeError, setActiveError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const handleToggleActive = () => {
    setActiveError(null);
    setActive.mutate(
      { id: row.Id, isActive: !row.Is_Active },
      {
        // Surfaces the backend's own guard (e.g. "you cannot deactivate your own
        // account") instead of silently no-op'ing on failure.
        onError: (err) => setActiveError(err instanceof ApiError ? err.message : "Could not update this account."),
      },
    );
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    resetPassword.mutate(
      { id: row.Id, newPassword },
      {
        onSuccess: () => {
          setResetDone(true);
          setNewPassword("");
        },
        onError: (err) => setResetError(err instanceof ApiError ? err.message : "Could not reset password."),
      },
    );
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{row.Username}</TableCell>
      <TableCell>{row.Name || <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell>{row.Role ?? <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="text-muted-foreground">{row.Email || row.Employee_Code || "—"}</TableCell>
      <TableCell>
        <Badge variant={row.Is_Active ? "secondary" : "destructive"}>{row.Is_Active ? "Active" : "Inactive"}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {row.Last_Login ? new Date(row.Last_Login).toLocaleString() : "Never"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <div className="flex justify-end gap-1.5">
            <Popover
              open={resetOpen}
              onOpenChange={(next) => {
                setResetOpen(next);
                if (!next) {
                  setNewPassword("");
                  setResetError(null);
                  setResetDone(false);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset password">
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                {resetDone ? (
                  <p className="text-sm text-primary">Password reset.</p>
                ) : (
                  <form className="space-y-2" onSubmit={handleReset}>
                    <Label className="text-xs">New password for {row.Username}</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    {resetError && <p className="text-xs text-destructive">{resetError}</p>}
                    <Button type="submit" size="sm" className="w-full" disabled={resetPassword.isPending}>
                      {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Reset
                    </Button>
                  </form>
                )}
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" disabled={setActive.isPending} onClick={handleToggleActive}>
              {row.Is_Active ? "Deactivate" : "Activate"}
            </Button>
          </div>
          {activeError && <p className="text-xs text-destructive">{activeError}</p>}
        </div>
      </TableCell>
    </TableRow>
  );
}
