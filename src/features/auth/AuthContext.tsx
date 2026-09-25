import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "@/shared/api/endpoints";
import type { AuthenticatedUser } from "@/features/rbac/types";

// Real session auth (added 2026-09-14, planning/auth_views.py) - replaces the old
// sessionStorage-of-a-locally-typed-object stand-in. The backend now owns the actual
// session (a Django cookie, sent automatically per request - see client.ts's
// credentials: "include"); this context just mirrors "am I logged in, and as whom" for
// the rest of the app to read, via GET /auth/me/ on mount so a page refresh doesn't
// drop a still-valid session.
interface AuthContextValue {
  user: AuthenticatedUser | null;
  // True only during the initial /auth/me/ check on mount - AppShell uses this to show
  // a loading state instead of bouncing a genuinely-logged-in user to /login for the
  // brief moment before that check resolves.
  isInitializing: boolean;
  // Throws ApiError (401 on bad credentials, 422 if the account has no role profile)
  // on failure - LoginPage catches this to show an inline message. Returns the
  // authenticated user on success (not just via context state) so the caller can
  // resolveDefaultView/navigate immediately without waiting on a re-render.
  login: (username: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // 401 (no session) is the expected outcome for a logged-out visitor - nothing
        // to surface, `user` just stays null.
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isInitializing,
      login: async (username, password) => {
        const authedUser = await authApi.login(username, password);
        setUser(authedUser);
        return authedUser;
      },
      logout: () => {
        setUser(null);
        // Fire-and-forget: the UI already treats the user as logged out immediately
        // (matches the old instant sessionStorage.removeItem behavior) - if this
        // request itself fails (e.g. network blip), the session cookie may briefly
        // outlive the client-side state, but the next authenticated request would
        // just re-hydrate `user` via a fresh /auth/me/ on the next mount, not silently
        // grant access to anything this tab isn't already showing.
        authApi.logout().catch(() => {});
      },
    }),
    [user, isInitializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
