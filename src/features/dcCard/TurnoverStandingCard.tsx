import { Wallet } from "lucide-react";
import type { TurnoverDetail } from "@/shared/types/dcCard";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// Structured, stat-row rendering of Turnover_Detail (planning/dc_card.py:
// _turnover_detail, added 2026-08-22) instead of the generic Who-section bullet text -
// same reasoning as BusinessAreaStrengthCard: last-FY purchase, this-year purchase,
// club-scheme qualifying turnover, and the YoY PL comparison used to run together as one
// dense Hindi sentence, hard to scan at a glance.
//
// "(gross, all orders)" labels (confirmed 2026-08-22, per direct instruction): these
// figures come from _sql_dc_purchase_summary - SUM(price_unit * quantity), no discount
// subtracted, every order line counted regardless of whether it resolves to a real
// product in the catalog. That's a genuinely different definition from Business Area
// Strength's "Total" (net of discount, requires a catalog match) - the two numbers will
// rarely match exactly, and that's not a bug in either one. Spelled out here rather than
// silently showing two similarly-labeled totals that happen to disagree.
export function TurnoverStandingCard({ detail }: { detail: TurnoverDetail | null }) {
  if (!detail) return null;

  const stats: { label: string; value: string }[] = [];
  if (detail.Purchase_Last_FY != null) {
    stats.push({ label: "Purchase last FY (gross, all orders)", value: currencyFormatter.format(detail.Purchase_Last_FY) });
  }
  if (detail.Purchase_YTD != null) {
    stats.push({ label: "Purchase this year YTD (gross, all orders)", value: currencyFormatter.format(detail.Purchase_YTD) });
  }
  if (detail.Qualifying_Turnover != null) {
    stats.push({ label: "Club qualifying turnover", value: currencyFormatter.format(detail.Qualifying_Turnover) });
  }

  if (stats.length === 0 && detail.YoY_PL_Growth_Pct == null) return null;

  const yoyUp = (detail.YoY_PL_Growth_Pct ?? 0) >= 0;

  return (
    <div className="rounded-md border bg-accent/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" />
        Turnover-wise standing
      </div>
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="font-semibold">{s.value}</div>
            </div>
          ))}
        </div>
      )}
      {detail.YoY_PL_Growth_Pct != null && (
        <div className={`mt-2 text-xs ${yoyUp ? "text-primary" : "text-destructive"}`}>
          PL sale {yoyUp ? "up" : "down"} {Math.abs(detail.YoY_PL_Growth_Pct * 100).toFixed(0)}% vs. same period last FY
          {detail.YTD_PL_Last_Year != null && ` (was ${currencyFormatter.format(detail.YTD_PL_Last_Year)})`}
        </div>
      )}
    </div>
  );
}
