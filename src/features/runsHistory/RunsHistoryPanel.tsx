import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/components/ui/drawer";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { useRunsList, useRunDetail } from "@/shared/api/hooks/useRuns";
import { TruncationNotice } from "@/shared/components/TruncationNotice";
import { PlanRunDetail } from "@/features/views/shared/PlanRunDetail";
import { PitchPanel } from "@/features/pitching/PitchPanel";
import { DCCardPanel } from "@/features/dcCard/DCCardPanel";
import { PlanDrawer } from "@/features/routing/PlanDrawer";
import { cn } from "@/shared/lib/cn";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { Task } from "@/shared/types/planRun";

// Real Status values (PlanRun.Status choices, SE_automation_server/planning/models.py) -
// an approval-workflow marker, not a generation-lifecycle state.
const STATUS_FILTERS = ["", "PENDING_REVIEW", "APPROVED", "REJECTED"];

interface RunsHistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

// §14 - past PlanRuns list (newest-first, max 50) with a status filter chip row,
// and full re-fetch of a selected run via GET /runs/<id>/.
export function RunsHistoryPanel({ open, onClose }: RunsHistoryPanelProps) {
  const [status, setStatus] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pitchTask, setPitchTask] = useState<Task | null>(null);
  const [dcCardTask, setDCCardTask] = useState<Task | null>(null);
  const [routesTarget, setRoutesTarget] = useState<{ seId: string; dcNames: Record<string, string> } | null>(
    null,
  );

  const listQuery = useRunsList(status ? { status } : undefined);
  const detailQuery = useRunDetail(selectedRunId ?? undefined);

  return (
    <>
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="max-w-2xl">
          <DrawerHeader>
            <div className="flex items-center gap-2">
              {selectedRunId && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedRunId(null)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <DrawerTitle>{selectedRunId ? `Run ${selectedRunId}` : "Run history"}</DrawerTitle>
            </div>
          </DrawerHeader>

          {!selectedRunId && (
            <div className="space-y-3 overflow-auto">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s || "all"}
                    onClick={() => setStatus(s)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      status === s ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s || "All"}
                  </button>
                ))}
              </div>

              {listQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading runs...
                </div>
              )}

              <TruncationNotice page={listQuery.data} />

              <div className="divide-y rounded-md border">
                {(listQuery.data?.data ?? []).map((run) => (
                  <button
                    key={run.PlanRun_ID}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => setSelectedRunId(run.PlanRun_ID)}
                  >
                    <div>
                      <div className="font-medium">
                        {run.Scope_Type}: {run.Scope_Value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {run.Plan_Date} - {run.SE_Count} SEs, {run.Task_Count} tasks
                      </div>
                    </div>
                    <Badge variant={run.Status === "REJECTED" ? "destructive" : "secondary"}>{run.Status}</Badge>
                  </button>
                ))}
                {listQuery.data?.data.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">No runs found.</div>
                )}
              </div>
            </div>
          )}

          {selectedRunId && (
            <div className="overflow-auto">
              {detailQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading run...
                </div>
              )}
              {detailQuery.data && (
                <PlanRunDetail
                  planRun={detailQuery.data}
                  onOpenPitch={setPitchTask}
                  onOpenDCCard={setDCCardTask}
                  onOpenRoutes={(seId, dcNames) => setRoutesTarget({ seId, dcNames })}
                />
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>

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
        planDate={detailQuery.data?.meta.Plan_Date ?? ""}
        dcNames={routesTarget?.dcNames}
        onClose={() => setRoutesTarget(null)}
      />
    </>
  );
}
