import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { resolveDefaultView } from "@/features/rbac/rbac";
import { useAppStore } from "@/shared/store/appStore";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

// Real login (added 2026-09-14, planning/auth_views.py) - replaces the old Role/Name/
// Email/Employee-code picker (which never called the backend at all - anyone could
// type "ADMIN" and get in). Role/email/employee_code now come back from the
// authenticated account (see AuthenticatedUser), not from anything typed here.
export function LoginPage() {
  const { login } = useAuth();
  const setRole = useAppStore((s) => s.setRole);
  const setDefaultView = useAppStore((s) => s.setDefaultView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(username, password);
      const { defaultView, allowedViewTypes } = resolveDefaultView(user);
      setRole(user.role, allowedViewTypes);
      setDefaultView(defaultView);
      setActiveView(defaultView.type);
      navigate(`/${defaultView.type}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not sign in. Try again.");
    } finally {
      setSubmitting(false);
    }
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
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
