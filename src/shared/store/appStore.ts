import { create } from "zustand";
import type { DateSelection, RotationChoice, RoutingPlanChoice, ScopeType, ViewType } from "@/shared/types/scope";

// Zustand owns only user selections/UI state; React Query owns everything
// server-derived (spec §17).
export interface AppStore {
  role: string | null;
  allowedViewTypes: ViewType[];
  defaultView: { type: ViewType; scopeValue: string } | null;

  dateSelection: DateSelection;
  // Which route-planning family (Plan A / Plan B / Plan C) to generate - global like
  // dateSelection since every scope GET regenerates the whole plan from scratch, so this
  // has to be threaded through every generation call, not just the Create/Refresh button
  // that first set it (else the next passive scope fetch would silently regenerate back
  // to Plan A - see useScopePlanRun.ts). Plan C (AI-Reasoned via an LLM, opened up to
  // this UI 2026-09-11) makes a real LLM call per SE in scope - see RoutingPlanSelector's
  // own warning copy before assuming this is as cheap/instant as A/B.
  routingPlan: RoutingPlanChoice;
  // Plan B's opt-in "Fixed Rotation" beat-zone restriction (?rotation=true) - kept
  // alongside routingPlan since it's silently a no-op server-side under anything but
  // Plan B; the UI resets it to false whenever routingPlan flips away from "B" (see
  // RoutingPlanSelector).
  enableRotation: RotationChoice;
  scopeSelection: Partial<Record<ScopeType, string[]>>;
  activeView: ViewType | null;

  setRole: (role: string, allowedViewTypes: ViewType[]) => void;
  setDefaultView: (view: { type: ViewType; scopeValue: string }) => void;
  setDateSelection: (d: DateSelection) => void;
  setRoutingPlan: (p: RoutingPlanChoice) => void;
  setEnableRotation: (r: RotationChoice) => void;
  setScopeSelection: (scope: ScopeType, values: string[]) => void;
  clearScopeSelection: (scope: ScopeType) => void;
  setActiveView: (v: ViewType) => void;
  reset: () => void;
}

const initialState = {
  role: null,
  allowedViewTypes: [] as ViewType[],
  defaultView: null,
  dateSelection: { type: "today" } as DateSelection,
  routingPlan: "A" as RoutingPlanChoice,
  enableRotation: false as RotationChoice,
  scopeSelection: {} as Partial<Record<ScopeType, string[]>>,
  activeView: null as ViewType | null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setRole: (role, allowedViewTypes) => set({ role, allowedViewTypes }),

  setDefaultView: (defaultView) => set({ defaultView }),

  setDateSelection: (dateSelection) => set({ dateSelection }),

  // Flipping away from Plan B also clears enableRotation - it's a silent no-op under
  // Plan A/C server-side, so leaving it "on" would just be a stale, misleading toggle state.
  setRoutingPlan: (routingPlan) =>
    set((state) => ({
      routingPlan,
      enableRotation: routingPlan === "B" ? state.enableRotation : false,
    })),

  setEnableRotation: (enableRotation) => set({ enableRotation }),

  setScopeSelection: (scope, values) =>
    set((state) => ({
      scopeSelection: { ...state.scopeSelection, [scope]: values },
    })),

  clearScopeSelection: (scope) =>
    set((state) => {
      const next = { ...state.scopeSelection };
      delete next[scope];
      return { scopeSelection: next };
    }),

  setActiveView: (activeView) => set({ activeView }),

  reset: () => set(initialState),
}));
