import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { resolveDefaultView } from "@/features/rbac/rbac";
import { useAppStore } from "@/shared/store/appStore";
import type { AppRole } from "@/features/rbac/types";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

const ROLES: AppRole[] = ["SE", "ABM", "RBM", "ZBM", "NATIONAL", "ADMIN"];

// Placeholder login screen standing in for real session/JWT auth (§4). Picks a
// role + identity, then hands off to RBAC to resolve the default view.
export function LoginPage() {
  const { login } = useAuth();
  const setRole = useAppStore((s) => s.setRole);
  const setDefaultView = useAppStore((s) => s.setDefaultView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const navigate = useNavigate();

  const [role, setRoleField] = useState<AppRole>("SE");
  const [email, setEmail] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = { role, email, employeeCode: employeeCode || null, name: name || email };
    login(user);
    const { defaultView, allowedViewTypes } = resolveDefaultView(user);
    setRole(role, allowedViewTypes);
    setDefaultView(defaultView);
    setActiveView(defaultView.type);
    navigate(`/${defaultView.type}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>SE Daily Planning</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRoleField(v as AppRole)}>
                <SelectTrigger id="role">
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
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email {role === "SE" && "(scope value)"}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {(role === "ABM" || role === "RBM" || role === "ZBM") && (
              <div className="space-y-1.5">
                <Label htmlFor="code">Employee code (scope value)</Label>
                <Input
                  id="code"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
