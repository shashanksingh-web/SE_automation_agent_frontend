import { useState } from "react";
import { useAppStore } from "@/shared/store/appStore";
import { ScopeSelector } from "@/features/scopeSelector/ScopeSelector";
import { DateSelector } from "@/features/dateSelector/DateSelector";
import { RoutingPlanSelector } from "@/features/routing/RoutingPlanSelector";
import { CreateOrRefreshButton } from "@/features/views/shared/CreateOrRefreshButton";
import { PlanRunDetail } from "@/features/views/shared/PlanRunDetail";
import { MultiScopeSummary } from "@/features/views/shared/MultiScopeSummary";
import { TaskTable } from "@/features/views/shared/TaskTable";
import { useMultiScopePlanRuns } from "@/shared/api/hooks/useScopePlanRun";
import { PitchPanel } from "@/features/pitching/PitchPanel";
import { DCCardPanel } from "@/features/dcCard/DCCardPanel";
import { PlanDrawer } from "@/features/routing/PlanDrawer";
import { Loader2 } from "lucide-react";
import type { ScopePathSegment, ScopeType } from "@/shared/types/scope";
import { dateSelectionToQueryParam } from "@/shared/types/scope";
import type { Task } from "@/shared/types/planRun";

type TuffScopeType = Exclude<ScopeType, "ZBM">;

interface ScopeViewProps {
  title: string;
  scopeType: TuffScopeType;
  pathSegment: ScopePathSegment;
}

// Shared shell for the 7 direct scope views (State/District/Block/Node/RBM/ABM/SE,
// §7/§20) - all consume the identical PlanRun response shape, so only the scope
// type and path segment differ between them.
export function ScopeView({ title, scopeType, pathSegment }: ScopeViewProps) {
  const scopeValues = useAppStore((s) => s.scopeSelection[scopeType] ?? []);
  const dateSelection = useAppStore((s) => s.dateSelection);
  const routingPlan = useAppStore((s) => s.routingPlan);
  const enableRotation = useAppStore((s) => s.enableRotation);
  const [pitchTask, setPitchTask] = useState<Task | null>(null);
  const [dcCardTask, setDCCardTask] = useState<Task | null>(null);
  const [routesTarget, setRoutesTarget] = useState<{ seId: string; dcNames: Record<string, string> } | null>(
    null,
  );

  const { merged, perScope, isLoading, isError, errors } = useMultiScopePlanRuns(
    pathSegment,
    scopeValues,
    dateSelection,
    routingPlan,
    enableRotation,
  );

  const planDate = dateSelectionToQueryParam(dateSelection) ?? new Date().toISOString().slice(0, 10);
  const single = scopeValues.length === 1 ? perScope[0] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DateSelector />
          <RoutingPlanSelector />
          <ScopeSelector scopeType={scopeType} />
          <CreateOrRefreshButton
            scopeType={scopeType}
            scopeValues={scopeValues}
            date={dateSelection}
            routingPlan={routingPlan}
            enableRotation={enableRotation}
          />
        </div>
      </div>

      {scopeValues.length === 0 && (
        <div className="rounded-md border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Select one or more {title.toLowerCase()} values above to load plans.
        </div>
      )}

      {isLoading && scopeValues.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {/* A PlanningError (422 - e.g. the Admin Panel's Scheduling weekly-off-day
              gate, added 2026-09-13) carries a precise, human-readable reason - show it
              verbatim rather than a generic "failed" message an admin would just retry
              pointlessly against an intentional policy block, not a transient error. */}
          {errors[0]?.message || "Failed to load one or more scopes. Retryable - try Create/Refresh again."}
        </div>
      )}

      {/* Single selection: render the real PlanRun meta (Status/Skipped_SEs/Reviewed, §7). */}
      {single?.data && !isLoading && (
        <PlanRunDetail
          planRun={single.data}
          onOpenPitch={setPitchTask}
          onOpenDCCard={setDCCardTask}
          onOpenRoutes={(seId, dcNames) => setRoutesTarget({ seId, dcNames })}
        />
      )}

      {/* Multi-select: Status/lifecycle is inherently per-run, so it gets its own
          strip; the task tables below are the merged aggregate (§7, §17). */}
      {scopeValues.length > 1 && (
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
                  exceptions={merged.exceptions}
                  onOpenPitch={setPitchTask}
                  onOpenDCCard={setDCCardTask}
                  onOpenRoutes={(seId, dcNames) => setRoutesTarget({ seId, dcNames })}
                />
              ))}
              {merged.seOrder.length === 0 && (
                <div className="rounded-md border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No SEs across the selected scopes for this date.
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
        exceptions={merged.exceptions}
        onClose={() => setRoutesTarget(null)}
      />
    </div>
  );
}
