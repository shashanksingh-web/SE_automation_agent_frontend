import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PlanRunResponse, SkippedSE } from "@/shared/types/planRun";

// Skipped_SEs gets its own dismissible summary near the task table - not buried
// only inside Exceptions_Report (§7).
export function SkippedSEsBanner({
  skippedSEs,
}: {
  skippedSEs: PlanRunResponse["Skipped_SEs"];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!skippedSEs || skippedSEs.length === 0 || dismissed) return null;

  return (
    <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1 font-medium text-warning-foreground"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {skippedSEs.length} SE{skippedSEs.length === 1 ? "" : "s"} skipped
        </button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:underline"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1">
          {skippedSEs.map((se) => (
            <SkippedSERow key={se.se_id} se={se} />
          ))}
        </ul>
      )}
    </div>
  );
}

// dc_breakdown (confirmed 2026-08-18) - the full root-cause analysis behind a skipped
// SE's one-line reason: which of its assigned DCs never even reached qualification
// (Section 6: Legal_Hold/visited-too-recently/rank-ineligible) vs which passed scope
// but failed every Visits/Outstanding/PL qualifier. Nested per-SE, not auto-expanded -
// a busy state (e.g. a full-state run) can skip dozens of SEs, each with its own DC
// list, so showing every breakdown by default would bury the summary line.
function SkippedSERow({ se }: { se: SkippedSE }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const breakdown = se.dc_breakdown;

  return (
    <li className="text-xs text-muted-foreground">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-medium text-foreground">{se.se_email}</span> - {se.reason}
        </div>
        {breakdown && (
          <button
            type="button"
            className="shrink-0 whitespace-nowrap text-foreground hover:underline"
            onClick={() => setDetailOpen((o) => !o)}
          >
            {detailOpen ? "Hide" : "Why"} ({breakdown.total_assigned_dcs} DCs)
          </button>
        )}
      </div>
      {detailOpen && breakdown && (
        <div className="mt-1.5 space-y-2 rounded border bg-background px-2 py-1.5">
          {breakdown.not_in_scope.length > 0 && (
            <div>
              <div className="font-medium text-foreground">
                {breakdown.not_in_scope.length} never reached qualification
              </div>
              <ul className="mt-0.5 max-h-40 space-y-0.5 overflow-y-auto">
                {breakdown.not_in_scope.map((dc) => (
                  <li key={dc.DC_ID}>
                    {dc.DC_Name ?? dc.DC_ID} - {dc.Reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {breakdown.in_scope_no_objective_match.length > 0 && (
            <div>
              <div className="font-medium text-foreground">
                {breakdown.in_scope_no_objective_match.length} in scope, failed every qualifier
              </div>
              <ul className="mt-0.5 max-h-40 space-y-1 overflow-y-auto">
                {breakdown.in_scope_no_objective_match.map((dc) => (
                  <li key={dc.DC_ID}>
                    <div className="font-medium text-foreground">{dc.DC_Name ?? dc.DC_ID}</div>
                    <div className="pl-2">
                      Visits: {dc.Visits}
                      <br />
                      Outstanding: {dc.Outstanding}
                      <br />
                      PL: {dc.PL}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
