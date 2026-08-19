import type { NormalizedPlanRun } from "@/shared/api/normalize";
import { StatusBanner, ReviewedBadge } from "@/features/views/shared/StatusBanner";
import { SkippedSEsBanner } from "@/features/views/shared/SkippedSEsBanner";
import { TaskTable } from "@/features/views/shared/TaskTable";
import { Badge } from "@/shared/components/ui/badge";
import type { Task } from "@/shared/types/planRun";

interface PlanRunDetailProps {
  planRun: Pick<NormalizedPlanRun, "meta" | "seById" | "seOrder" | "exceptions">;
  onOpenPitch: (task: Task) => void;
  onOpenDCCard: (task: Task) => void;
  onOpenRoutes: (seId: string, dcNames: Record<string, string>) => void;
}

// Shared renderer for the PlanRun shape (§7) - used by every scope view and by
// Runs History detail (§14), since both consume the identical response shape.
export function PlanRunDetail({ planRun, onOpenPitch, onOpenDCCard, onOpenRoutes }: PlanRunDetailProps) {
  const { meta, seById, seOrder } = planRun;

  return (
    <div className="space-y-4">
      <StatusBanner status={meta.Status} errorMessage={meta.Error_Message} />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{meta.SE_Count} SEs</Badge>
        <Badge variant="outline">{meta.DC_Count} DCs</Badge>
        <Badge variant="outline">{meta.Task_Count} tasks</Badge>
        {!meta.Metabase_Configured && <Badge variant="warning">Metabase not configured</Badge>}
        <ReviewedBadge reviewedBy={meta.Reviewed_By} reviewedAt={meta.Reviewed_At} />
      </div>

      <SkippedSEsBanner skippedSEs={meta.Skipped_SEs} />

      <div className="space-y-3">
        {seOrder.map((seId) => (
          <TaskTable
            key={seId}
            seId={seId}
            seName={seById[seId].SE_Name}
            tasks={seById[seId].taskOrder.map((dcId) => seById[seId].taskIdsByDcId[dcId])}
            onOpenPitch={onOpenPitch}
            onOpenDCCard={onOpenDCCard}
            onOpenRoutes={onOpenRoutes}
          />
        ))}
        {seOrder.length === 0 && (
          <div className="rounded-md border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No SEs in this scope for the selected date.
          </div>
        )}
      </div>
    </div>
  );
}
