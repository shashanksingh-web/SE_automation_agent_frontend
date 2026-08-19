import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { isRejected, isApproved, type PlanRunStatus } from "@/shared/types/planRun";
import { Badge } from "@/shared/components/ui/badge";

// Status is a post-hoc approval-workflow marker (PENDING_REVIEW / APPROVED / REJECTED),
// not a generation-progress state - every scope/tuff GET already returns a finished
// plan synchronously, there's nothing async to wait on here (see useScopePlanRun.ts).
// Error_Message is defensive: a failed *generation* surfaces as an HTTP 422/502 at the
// fetch level (handled by the caller's isError banner), not as a persisted PlanRun, but
// this stays in case a future workflow attaches an error to an already-persisted run.
export function StatusBanner({
  status,
  errorMessage,
}: {
  status: PlanRunStatus;
  errorMessage: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isApproved(status) && (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Approved
        </Badge>
      )}
      {isRejected(status) && (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> Rejected
        </Badge>
      )}
      {!isApproved(status) && !isRejected(status) && (
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" /> {status || "Pending review"}
        </Badge>
      )}

      {errorMessage && (
        <span className="flex items-center gap-1 text-sm text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> {errorMessage}
        </span>
      )}
    </div>
  );
}

export function ReviewedBadge({
  reviewedBy,
  reviewedAt,
}: {
  reviewedBy: string | null;
  reviewedAt: string | null;
}) {
  if (!reviewedBy) return null;
  return (
    <Badge variant="secondary" className="gap-1">
      <CheckCircle2 className="h-3 w-3" />
      Reviewed by {reviewedBy}
      {reviewedAt && ` at ${new Date(reviewedAt).toLocaleString()}`}
    </Badge>
  );
}
