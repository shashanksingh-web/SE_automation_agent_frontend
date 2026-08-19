import type { DateSelection } from "@/shared/types/scope";
import { dateSelectionCacheKey } from "@/shared/types/scope";

// Every data-fetching hook keys on dateSelectionCacheKey so Today/Tomorrow/Custom
// cache independently (spec §5).
export const queryKeys = {
  directory: {
    states: () => ["directory", "states"] as const,
    nodes: (state?: string) => ["directory", "nodes", state ?? "all"] as const,
    districts: (state: string) => ["directory", "districts", state] as const,
    blocks: (state: string, district: string) =>
      ["directory", "blocks", state, district] as const,
    zbms: () => ["directory", "zbms"] as const,
    rbms: () => ["directory", "rbms"] as const,
    abms: () => ["directory", "abms"] as const,
    ses: (state?: string, node?: string) =>
      ["directory", "ses", state ?? "all", node ?? "all"] as const,
    dcs: (params: { state?: string; node?: string; se?: string; offset?: number }) =>
      ["directory", "dcs", params] as const,
  },
  scope: (segment: string, scopeValue: string, date: DateSelection) =>
    ["scope", segment, scopeValue, dateSelectionCacheKey(date)] as const,
  tuff: (scopeType: string, scopeValue: string, date: DateSelection) =>
    ["tuff", scopeType, scopeValue, dateSelectionCacheKey(date)] as const,
  routes: (se: string, planDate: string, planRun?: string) =>
    ["routes", se, planDate, planRun ?? "latest"] as const,
  pitch: (dailyTaskId: number) => ["pitch", dailyTaskId] as const,
  dcCard: (dailyTaskId: number) => ["dc-card", dailyTaskId] as const,
  headcount: (list: boolean) => ["headcount", list] as const,
  streaks: (se?: string, dc?: string, minMisses?: number) =>
    ["streaks", se ?? "all", dc ?? "all", minMisses ?? "all"] as const,
  completionStats: (se?: string, objective?: string) =>
    ["completion-stats", se ?? "all", objective ?? "all"] as const,
  scheduledScopes: (active?: boolean, scopeType?: string) =>
    ["scheduled-scopes", active ?? "all", scopeType ?? "all"] as const,
  runs: (scopeType?: string, scopeValue?: string, status?: string) =>
    ["runs", scopeType ?? "all", scopeValue ?? "all", status ?? "all"] as const,
  run: (planRunId: string) => ["runs", "detail", planRunId] as const,
};
