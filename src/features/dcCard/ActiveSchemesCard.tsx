import { Tag, CheckCircle2, HelpCircle } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import type { ActiveSchemesDetail } from "@/shared/types/dcCard";

// Structured rendering of Active_Schemes_Detail (planning/dc_card.py:
// _active_schemes_detail, added 2026-09-19, explicit user request - "if i want to
// check which scheme is recomending in which [node] actually he is in" / "in which
// scheme actually running and elligible"). Active Sales/ABS Schemes are matched by
// this DC's own Node (every DC in the same Node shares the same list, deliberately -
// see services.py's own comment) - the pitch itself only ever quoted the winning
// numbers, with no trace of which Node produced the match or which schemes were only
// loosely matched. This card makes both visible: the Node badge up top answers "why do
// I see these," and each scheme's own badge answers "is this one actually confirmed."
export function ActiveSchemesCard({ detail }: { detail: ActiveSchemesDetail | null }) {
  // null (backend: no Node on record for this DC at all) - genuinely nothing to show,
  // distinct from a real Node with zero active schemes (Schemes: []), handled below.
  if (!detail) return null;

  return (
    <div className="rounded-md border bg-accent/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Tag className="h-3.5 w-3.5" />
          Active Sales / ABS Schemes
        </div>
        {detail.Node && (
          <Badge variant="secondary" title="Every DC in this Node shares the same scheme list - that's the scope these schemes are defined at, not a per-DC match.">
            Node: {detail.Node}
          </Badge>
        )}
      </div>

      {detail.Schemes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active scheme on file for this Node right now.</p>
      ) : (
        <ul className="space-y-2">
          {detail.Schemes.map((s, i) => (
            <li key={i} className="rounded border bg-background/60 p-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm font-medium">{s.Name}</div>
                {s.Confirmed_Eligible ? (
                  <Badge
                    variant="default"
                    title="services.py matched this scheme against the coupon_service feed, and that scheme's own node/state rule covers this DC's Node - the profit figures below are real, the same ones the pitch quotes."
                    className="shrink-0 gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Confirmed eligible
                  </Badge>
                ) : (
                  <Badge
                    variant="warning"
                    title="This DC's Node has an active scheme row on file, but the richer coupon_service join either found no match (e.g. its booking window already closed) or matched a scheme whose own rule does not cover this Node - this DC's own eligibility is not confirmed."
                    className="shrink-0 gap-1 cursor-help"
                  >
                    <HelpCircle className="h-3 w-3" /> Node-listed only
                  </Badge>
                )}
              </div>
              {s.Valid_Until && <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Valid until {s.Valid_Until}</div>}
              {s.Profit_Hindi && <div className="mt-1 text-xs">{s.Profit_Hindi}</div>}
              {!s.Confirmed_Eligible && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Eligibility numbers not confirmed for this DC - verify before quoting a discount.
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
