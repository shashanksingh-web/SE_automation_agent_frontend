import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { authApi } from "@/shared/api/endpoints";
import { ApiError } from "@/shared/api/client";

// Self-service password change (added 2026-09-14, planning/auth_views.py
// auth_change_password) - available to every logged-in user, not just ADMIN (see
// Admin Panel's UsersPanel for the admin-reset-someone-else's-password counterpart).
// A Popover rather than a route/Drawer - this is a quick, occasional action from
// wherever the sidebar already is, not a page of its own.
export function ChangePasswordPopover() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change password. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <KeyRound className="h-4 w-4" />
          Change password
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-72">
        {success ? (
          <p className="text-sm text-primary">Password changed.</p>
        ) : (
          <form className="space-y-2" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <Label htmlFor="current-password" className="text-xs">
                Current password
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-password" className="text-xs">
                New password
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password" className="text-xs">
                Confirm new password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" size="sm" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
