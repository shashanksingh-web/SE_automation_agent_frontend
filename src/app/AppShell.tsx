import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Map, Building2, Users, UserRound, User, Shield, History, LogOut, Settings, ClipboardList, Loader2, Menu, X } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAppStore } from "@/shared/store/appStore";
import { resolveDefaultView } from "@/features/rbac/rbac";
import { Button } from "@/shared/components/ui/button";
import { RunsHistoryPanel } from "@/features/runsHistory/RunsHistoryPanel";
import { ChangePasswordPopover } from "@/features/auth/ChangePasswordPopover";
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
  { type: "admin", label: "Admin", icon: Settings },
  { type: "system-plan-runs", label: "System Plan Runs", icon: ClipboardList },
];

// §18 component tree: Sidebar filtered by RBAC (§4), TopBar (per-view here, see
// ScopeView/ZbmView/OverallView/OpsView), MainContent via <Outlet/>, plus the
// global RunsHistoryPanel overlay.
export function AppShell() {
  const { user, isInitializing, logout } = useAuth();
  const role = useAppStore((s) => s.role);
  const allowedViewTypes = useAppStore((s) => s.allowedViewTypes);
  const setRole = useAppStore((s) => s.setRole);
  const setDefaultView = useAppStore((s) => s.setDefaultView);
  const reset = useAppStore((s) => s.reset);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Mobile nav (added 2026-09-14, explicit user request - responsive SE/ABM screens):
  // below md:, the sidebar is off-canvas by default (a field SE/ABM's phone has no
  // room for a permanently-visible 224px rail) - this only tracks whether it's pulled
  // into view, it doesn't change anything about the desktop layout at md: and up.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on every navigation - without this, tapping a nav link
  // would leave the overlay open on top of the page it just navigated to.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // AuthProvider restores `user` from a real session (GET /auth/me/) on a hard reload,
  // but the Zustand store (role/allowedViewTypes/scope+date selection) is in-memory
  // only and resets to empty - without this, a refreshed page shows an authenticated
  // user with a sidebar that has filtered every nav item away. Re-derive RBAC state
  // from the restored user whenever it's out of sync, not just on login.
  useEffect(() => {
    if (user && role !== user.role) {
      const { defaultView, allowedViewTypes } = resolveDefaultView(user);
      setRole(user.role, allowedViewTypes);
      setDefaultView(defaultView);
    }
  }, [user, role, setRole, setDefaultView]);

  // Wait for the initial session check before deciding to bounce to /login - without
  // this, a genuinely logged-in user briefly flashes the login page on every hard
  // refresh while GET /auth/me/ is still in flight.
  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b px-4 py-4">
        <div>
          <div className="text-sm font-semibold">SE Daily Planning</div>
          <div className="text-xs text-muted-foreground">{user.name} ({user.role})</div>
        </div>
        {/* Close affordance only ever visible in the mobile off-canvas drawer - the
            md:+ static sidebar has no reason to be dismissible. */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
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
        <ChangePasswordPopover />
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
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop/tablet: the sidebar is always in flow, exactly as before. */}
      <aside className="hidden w-56 flex-col overflow-y-auto border-r bg-muted/20 md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile: off-canvas drawer + backdrop, only mounted below md:. A field SE/ABM's
          phone has no room for a permanent 224px rail, so the sidebar starts hidden and
          slides in over the page instead of squeezing it - same content either way, no
          separate mobile nav data/logic to keep in sync with the desktop one. */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80vw] flex-col overflow-y-auto border-r bg-background transition-transform duration-200 md:hidden",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile-only top bar - the sole way to reopen the drawer once it's closed,
            since below md: there's no other persistent chrome on screen. */}
        <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2 md:hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileNavOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold">SE Daily Planning</span>
        </div>

        <main className="flex-1 overflow-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>

      <RunsHistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
