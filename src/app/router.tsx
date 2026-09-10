import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { OverallView } from "@/features/views/OverallView";
import { ZbmView } from "@/features/views/ZbmView";
import { ScopeView } from "@/features/views/ScopeView";
import { OpsView } from "@/features/views/OpsView";
import { AdminView } from "@/features/views/AdminView";
import { AllPlanRunsPanel } from "@/features/views/AllPlanRunsPanel";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/overall" replace /> },
      { path: "overall", element: <OverallView /> },
      { path: "zbm", element: <ZbmView /> },
      { path: "state", element: <ScopeView title="State" scopeType="STATE" pathSegment="state" /> },
      {
        path: "district",
        element: <ScopeView title="District" scopeType="DISTRICT" pathSegment="district" />,
      },
      { path: "block", element: <ScopeView title="Block" scopeType="BLOCK" pathSegment="block" /> },
      { path: "node", element: <ScopeView title="Node" scopeType="NODE" pathSegment="node" /> },
      { path: "rbm", element: <ScopeView title="RBM" scopeType="RBM" pathSegment="rbm" /> },
      { path: "abm", element: <ScopeView title="ABM" scopeType="ABM" pathSegment="abm" /> },
      { path: "se", element: <ScopeView title="SE" scopeType="SE" pathSegment="se" /> },
      { path: "ops", element: <OpsView /> },
      { path: "admin", element: <AdminView /> },
      { path: "system-plan-runs", element: <AllPlanRunsPanel /> },
    ],
  },
]);
