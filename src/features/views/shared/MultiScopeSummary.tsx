import { Badge } from "@/shared/components/ui/badge";
import { isRejected, isApproved } from "@/shared/types/planRun";
import type { NormalizedPlanRun } from "@/shared/api/normalize";

// Per-run Status/Skipped_SEs/Reviewed are inherently per-PlanRun (§7) - when
// multiple scope values are selected (multi-select fan-out, §7) each keeps its
// own approval-status strip here, while the task tables below are the merged view.
export function MultiScopeSummary({
  runs,
}: {
  runs: Array<{ scopeValue: string; data: NormalizedPlanRun | undefined; isLoading: boolean }>;
}) {
  if (runs.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {runs.map(({ scopeValue, data, isLoading }) => (
        <div key={scopeValue} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
          <span className="font-medium">{scopeValue}</span>
          {isLoading && <span className="text-muted-foreground">generating...</span>}
          {data && (
            <Badge variant={isRejected(data.meta.Status) ? "destructive" : isApproved(data.meta.Status) ? "secondary" : "warning"}>
              {data.meta.Status}
            </Badge>
          )}
          {data && data.meta.Skipped_SEs && data.meta.Skipped_SEs.length > 0 && (
            <Badge variant="warning">{data.meta.Skipped_SEs.length} skipped</Badge>
          )}
        </div>
      ))}
    </div>
  );
}
