import { useMemo, useState } from "react";
import { useAppStore } from "@/shared/store/appStore";
import { ScopeSelector } from "@/features/scopeSelector/ScopeSelector";
import { DateSelector } from "@/features/dateSelector/DateSelector";
import { CreateOrRefreshButton } from "@/features/views/shared/CreateOrRefreshButton";
import { MultiScopeSummary } from "@/features/views/shared/MultiScopeSummary";
import { TaskTable } from "@/features/views/shared/TaskTable";
import { useZbms } from "@/shared/api/hooks/useDirectory";
import { useMultiScopePlanRuns } from "@/shared/api/hooks/useScopePlanRun";
import { PitchPanel } from "@/features/pitching/PitchPanel";
import { DCCardPanel } from "@/features/dcCard/DCCardPanel";
import { PlanDrawer } from "@/features/routing/PlanDrawer";
import { Loader2 } from "lucide-react";
import { dateSelectionToQueryParam } from "@/shared/types/scope";
import type { Task } from "@/shared/types/planRun";

// ZBM / "State Head" (§7, §8): no direct /zbm/<code>/ plan endpoint exists. The
// view is composed client-side - look up covered states via directory/zbms/,
// then call /state/<name>/ once per covered state and merge, same
// fan-out-and-merge pattern as ordinary multi-select.
export function ZbmView() {
  const zbmValues = useAppStore((s) => s.scopeSelection.ZBM ?? []);
  const dateSelection = useAppStore((s) => s.dateSelection);
  const [pitchTask, setPitchTask] = useState<Task | null>(null);
  const [dcCardTask, setDCCardTask] = useState<Task | null>(null);
  const [routesTarget, setRoutesTarget] = useState<{ seId: string; dcNames: Record<string, string> } | null>(
    null,
  );

  const zbmsQuery = useZbms();

  const coveredStates = useMemo(() => {
    const zbms = zbmsQuery.data ?? [];
    const states = new Set<string>();
    for (const code of zbmValues) {
      const zbm = zbms.find((z) => z.code === code);
      zbm?.states.forEach((s) => states.add(s));
    }
    return [...states];
  }, [zbmsQuery.data, zbmValues]);

  const { merged, perScope, isLoading, isError } = useMultiScopePlanRuns(
    "state",
    coveredStates,
    dateSelection,
  );

  const planDate = dateSelectionToQueryParam(dateSelection) ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">ZBM / State Head</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DateSelector />
          <ScopeSelector scopeType="ZBM" />
          <CreateOrRefreshButton scopeType="STATE" scopeValues={coveredStates} date={dateSelection} />
        </div>
      </div>

      {zbmValues.length === 0 && (
        <div className="rounded-md border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Select one or more ZBM / State Head values above.
        </div>
      )}

      {zbmValues.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Covering {coveredStates.length} state{coveredStates.length === 1 ? "" : "s"}:{" "}
          {coveredStates.join(", ") || "-"}
        </p>
      )}

      {isLoading && coveredStates.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Failed to load one or more states. Retryable - try Create/Refresh again.
        </div>
      )}

      {coveredStates.length > 0 && (
        <div className="space-y-4">
          <MultiScopeSummary runs={perScope} />
          {!isLoading && (
            <div className="space-y-3">
              {merged.seOrder.map((seId) => (
                <TaskTable
                  key={seId}
                  seId={seId}
                  seName={merged.seById[seId].SE_Name}
                  tasks={merged.seById[seId].taskOrder.map(
                    (dcId) => merged.seById[seId].taskIdsByDcId[dcId],
                  )}
                  onOpenPitch={setPitchTask}
                  onOpenDCCard={setDCCardTask}
                  onOpenRoutes={(seId, dcNames) => setRoutesTarget({ seId, dcNames })}
                />
              ))}
              {merged.seOrder.length === 0 && (
                <div className="rounded-md border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No SEs across the covered states for this date.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <PitchPanel
        dailyTaskId={pitchTask?.DailyTask_ID ?? null}
        dcName={pitchTask?.DC_Name}
        onClose={() => setPitchTask(null)}
      />
      <DCCardPanel
        dailyTaskId={dcCardTask?.DailyTask_ID ?? null}
        dcName={dcCardTask?.DC_Name}
        onClose={() => setDCCardTask(null)}
      />
      <PlanDrawer
        se={routesTarget?.seId ?? null}
        planDate={planDate}
        dcNames={routesTarget?.dcNames}
        onClose={() => setRoutesTarget(null)}
      />
    </div>
  );
}
