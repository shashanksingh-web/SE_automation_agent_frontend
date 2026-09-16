import { HeartPulse } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import type { HealthScoreDetail } from "@/shared/types/dcCard";

// Health_Sub_Scores' bucket -> Badge color (business-confirmed cutoffs, Source 3k) -
// same convention TaskTable.tsx uses for the task-level Health score block.
const HEALTH_BUCKET_VARIANTS: Record<string, "default" | "warning" | "destructive" | "secondary"> = {
  Strong: "default",
  Fine: "default",
  Weak: "warning",
  Worst: "destructive",
};

// Credit/OD read from a genuinely different system (Locus ledger) than the fields they
// most resemble by name - same clarification as TaskTable.tsx's task-level block
// (verified live 2026-09-07 that credit-line utilization, payment-timeliness, and
// debt-aging are three independent signals, not different views of the same number).
const HEALTH_COMPONENT_TOOLTIPS: Record<string, string> = {
  Credit: "Payment timeliness (pct of payments made by their due date x an on-time-delay factor), from real loan/payment history - independent of this DC's credit-line utilization and of OD below (that's debt aging).",
  OD: "Share of this DC's unpaid ledger invoices aged 90+ days specifically, from Locus's own per-invoice records - NOT the same system as this DC's dc_datamart-sourced overdue figures shown elsewhere. A DC can have real 1-90 day overdue with zero 90+ debt and correctly score Strong here.",
};

// Structured, stat-row rendering of Health_Score_Detail (planning/dc_card.py:
// _health_score_detail, added 2026-09-06; API serialization added 2026-09-07) - a
// genuinely new card section, not a repurposing of the vacated Private Label slot (see
// DCCardResponse's own doc comment). Same reasoning as TurnoverStandingCard/
// BusinessAreaStrengthCard: the Hindi narrative reads fine but a bucket-colored badge
// row is easier to scan at a glance than a 7-line bullet list.
export function HealthScoreCard({ detail }: { detail: HealthScoreDetail | null }) {
  // {} (backend: DCCard.health_score_detail default) when this DC had neither a
  // computed Health Score nor a Health-Focus selection at all this run - genuinely
  // nothing to show. DC_Health_Score==null + Health_Focus_Track==true is a different,
  // real state (GR-28's 60-day-bypass case, see below) - not treated as "no data".
  if (!detail || (detail.DC_Health_Score == null && !detail.Health_Focus_Track)) return null;

  return (
    <div className="rounded-md border bg-accent/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <HeartPulse className="h-3.5 w-3.5" />
        DC Composite Health Score
      </div>
      {detail.DC_Health_Score == null ? (
        // GR-28's 60-day-bypass case (se_daily_plan_agent.py, added 2026-09-06): a real
        // overdue balance force-included this DC via GR-28, but it never got a full
        // Health Score composite at all (failed the Score's own active/Days_Since_Last_
        // Sale<=60 eligibility gate) - an explicit, explainable bypass, not silent
        // missing data (same convention as TaskTable.tsx's task-level Health score block).
        <div className="text-xs text-muted-foreground">
          No Health Score computed this run - this DC failed the Score's own 60-day
          recent-sale eligibility gate; selected anyway via GR-28's real-overdue override.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Health score</div>
              <div className="font-semibold">{Math.round(detail.DC_Health_Score)}/100</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Health gap</div>
              <div className="font-semibold">{detail.Health_Gap != null ? Math.round(detail.Health_Gap) : "N/A"}</div>
            </div>
          </div>
          {detail.Negative_GM_Flag && (
            <div className="mt-2 text-xs text-destructive">
              Negative GM - loss-making, GM/GM% flagged for manual review instead of a normal score
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(detail.Sub_Scores).map(([component, sub]) => (
              <Badge
                key={component}
                variant={HEALTH_BUCKET_VARIANTS[sub.bucket]}
                title={`${HEALTH_COMPONENT_TOOLTIPS[component] ? HEALTH_COMPONENT_TOOLTIPS[component] + " " : ""}Urgency ${sub.urgency.toFixed(2)}`}
                className="cursor-help"
              >
                {component}: {sub.bucket}
                {sub.score_pct != null && ` (${Math.round(sub.score_pct * 100)}%)`}
              </Badge>
            ))}
          </div>
        </>
      )}
      {detail.Health_Focus_Track && (
        <div className="mt-2 text-xs text-muted-foreground">
          Also selected today via the Health-Focus track ({detail.Health_Focus_Purposes || "GR-28"})
        </div>
      )}
    </div>
  );
}
