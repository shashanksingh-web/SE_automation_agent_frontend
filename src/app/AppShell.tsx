import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate } from "react-router-dom";
import { LayoutDashboard, Map, Building2, Users, UserRound, User, Shield, History, LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAppStore } from "@/shared/store/appStore";
import { resolveDefaultView } from "@/features/rbac/rbac";
import { Button } from "@/shared/components/ui/button";
import { RunsHistoryPanel } from "@/features/runsHistory/RunsHistoryPanel";
import { cn } from "@/shared/lib/cn";
import type { ViewType } from "@/shared/types/scope";

const NAV_ITEMS: Array<{ type: ViewType; label: string; icon: typeof LayoutDashboard }> = [
  { type: "overall", label: "Overall", icon: LayoutDashboard },
  { type: "zbm", label: "ZBM / State Head", icon: Map },
  { type: "state", label: "State", icon: Building2 },
  { type: "rbm", label: "RBM", icon: Users },
  { type: "abm", label: "ABM", icon: UserRound },
  { type: "se", label: "SE", icon: User },
  { type: "ops", label: "Ops", icon: Shield },
];

// §18 component tree: Sidebar filtered by RBAC (§4), TopBar (per-view here, see
// ScopeView/ZbmView/OverallView/OpsView), MainContent via <Outlet/>, plus the
// global RunsHistoryPanel overlay.
export function AppShell() {
  const { user, logout } = useAuth();
  const role = useAppStore((s) => s.role);
  const allowedViewTypes = useAppStore((s) => s.allowedViewTypes);
  const setRole = useAppStore((s) => s.setRole);
  const setDefaultView = useAppStore((s) => s.setDefaultView);
  const reset = useAppStore((s) => s.reset);
  const [historyOpen, setHistoryOpen] = useState(false);

  // AuthProvider restores `user` from sessionStorage on a hard reload, but the
  // Zustand store (role/allowedViewTypes/scope+date selection) is in-memory only
  // and resets to empty - without this, a refreshed page shows an authenticated
  // user with a sidebar that has filtered every nav item away. Re-derive RBAC
  // state from the restored user whenever it's out of sync, not just on login.
  useEffect(() => {
    if (user && role !== user.role) {
      const { defaultView, allowedViewTypes } = resolveDefaultView(user);
      setRole(user.role, allowedViewTypes);
      setDefaultView(defaultView);
    }
  }, [user, role, setRole, setDefaultView]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-56 flex-col overflow-y-auto border-r bg-muted/20">
        <div className="border-b px-4 py-4">
          <div className="text-sm font-semibold">SE Daily Planning</div>
          <div className="text-xs text-muted-foreground">{user.name} ({user.role})</div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV_ITEMS.filter((item) => allowedViewTypes.includes(item.type)).map((item) => (
            <NavLink
              key={item.type}
              to={`/${item.type}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t p-2">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4" />
            Run history
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              logout();
              reset();
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>

      <RunsHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
