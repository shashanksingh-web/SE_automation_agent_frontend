import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@/features/rbac/types";

// App-shell auth (spec §4): standard session/JWT login, layered ON TOP of the
// (unauthenticated) planning API. The planning API itself needs none of this.
//
// This context is a stand-in for a real login flow (session cookie / JWT
// exchange against your identity provider) - swap `login` below for a real
// call to your auth backend. The shape (AuthenticatedUser) is what RBAC (§4)
// consumes; keep that contract when wiring up the real thing.
interface AuthContextValue {
  user: AuthenticatedUser | null;
  login: (user: AuthenticatedUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "se-planning.auth.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (nextUser) => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
        setUser(nextUser);
      },
      logout: () => {
        sessionStorage.removeItem(STORAGE_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
