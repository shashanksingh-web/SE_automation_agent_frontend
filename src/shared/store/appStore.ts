import { create } from "zustand";
import type { DateSelection, ScopeType, ViewType } from "@/shared/types/scope";

// Zustand owns only user selections/UI state; React Query owns everything
// server-derived (spec §17).
export interface AppStore {
  role: string | null;
  allowedViewTypes: ViewType[];
  defaultView: { type: ViewType; scopeValue: string } | null;

  dateSelection: DateSelection;
  scopeSelection: Partial<Record<ScopeType, string[]>>;
  activeView: ViewType | null;

  setRole: (role: string, allowedViewTypes: ViewType[]) => void;
  setDefaultView: (view: { type: ViewType; scopeValue: string }) => void;
  setDateSelection: (d: DateSelection) => void;
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
  scopeSelection: {} as Partial<Record<ScopeType, string[]>>,
  activeView: null as ViewType | null,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setRole: (role, allowedViewTypes) => set({ role, allowedViewTypes }),

  setDefaultView: (defaultView) => set({ defaultView }),

  setDateSelection: (dateSelection) => set({ dateSelection }),

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
