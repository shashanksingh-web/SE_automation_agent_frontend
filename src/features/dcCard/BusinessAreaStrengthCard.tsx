import { useState } from "react";
import { LineChart } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import type { BusinessAreaDetail, BusinessAreaSubCategory } from "@/shared/types/dcCard";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function SubCategoryRow({ sc }: { sc: BusinessAreaSubCategory }) {
  return (
    <div className="rounded-md border p-2.5">
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        <span>{sc.Sub_Category}</span>
        <span className="text-muted-foreground">{currencyFormatter.format(sc.Total)}</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {sc.Segments.map((seg, i) => (
          <div key={i} className="text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={seg.Segment === "Private Label" ? "default" : "secondary"} className="shrink-0">
                {seg.Segment}
              </Badge>
              <span className="text-muted-foreground">
                {currencyFormatter.format(seg.Total)} ({seg.Share_Of_Subcategory.toFixed(0)}%)
              </span>
            </div>
            {seg.Products.length > 0 && (
              <ul className="mt-0.5 list-inside list-disc space-y-0.5 pl-1 text-muted-foreground">
                {seg.Products.map((p, j) => (
                  <li key={j}>
                    {p.Name}
                    {p.Value != null && ` (${currencyFormatter.format(p.Value)})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Structured, table-like rendering of Business_Area_Detail (rebuilt 2026-08-22: every
// sub-category this fiscal-YTD, Branded vs. Private Label split with share%, product-
// wise within each segment) - a dedicated card instead of the generic Who-section bullet
// text, since this data got too dense (sub-categories x segments x products x 2 years)
// to stay readable as prose. Both years' sub-category breakdowns are collapsed behind
// their own toggle rather than always shown (added 2026-08-26, per direct instruction -
// this year's list used to be always-expanded while only last year's was a toggle,
// inconsistent given a DC can have just as many current-year sub-categories as prior-
// year ones) - the stat header above stays visible either way. When no prior-year data
// exists, says so explicitly rather than just omitting the toggle.
//
// "Catalog-classified total (net of discount)" label (confirmed 2026-08-22, per direct
// instruction): this sum comes from _sql_business_area_strength_detailed - net of
// discount_price_unit, and only counts order lines that resolve to a real product in the
// catalog (INNER JOIN products_product/products_template - an unmatched line, or a
// product that's mostly returns this window, is dropped entirely). That's a genuinely
// different definition from Turnover-wise Standing's "Purchase this year YTD" (gross,
// every order line counted) - the two will rarely match exactly, and that's not a bug in
// either one. Spelled out here rather than showing two similarly-labeled totals that
// happen to disagree.
export function BusinessAreaStrengthCard({ detail }: { detail: BusinessAreaDetail | null }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showPrior, setShowPrior] = useState(false);
  if (!detail) return null;

  const brandedPct = detail.Current_Total ? (detail.Current_Branded_Total / detail.Current_Total) * 100 : 0;
  const plPct = detail.Current_Total ? (detail.Current_PL_Total / detail.Current_Total) * 100 : 0;

  return (
    <div className="rounded-md border bg-accent/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <LineChart className="h-3.5 w-3.5" />
        Business area strength - this year YTD
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Catalog-classified total (net of discount)</div>
          <div className="font-semibold">{currencyFormatter.format(detail.Current_Total)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Branded</div>
          <div>{currencyFormatter.format(detail.Current_Branded_Total)} ({brandedPct.toFixed(0)}%)</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Private Label</div>
          <div>{currencyFormatter.format(detail.Current_PL_Total)} ({plPct.toFixed(0)}%)</div>
        </div>
      </div>

      <button
        type="button"
        className="text-xs font-medium text-primary hover:underline"
        onClick={() => setShowCurrent((s) => !s)}
      >
        {showCurrent ? "Hide" : "Show"} this year's breakdown ({detail.Current.length} sub-categor{detail.Current.length === 1 ? "y" : "ies"})
      </button>
      {showCurrent && (
        <div className="mt-2 space-y-2">
          {detail.Current.map((sc, i) => (
            <SubCategoryRow key={i} sc={sc} />
          ))}
        </div>
      )}

      <div className="mt-3 border-t pt-2">
        {detail.Prior && detail.Prior.length > 0 ? (
          <>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setShowPrior((s) => !s)}
            >
              {showPrior ? "Hide" : "Compare to"} last year ({currencyFormatter.format(detail.Prior_Total ?? 0)} same period)
            </button>
            {showPrior && (
              <div className="mt-2 space-y-2">
                {detail.Prior.map((sc, i) => (
                  <SubCategoryRow key={i} sc={sc} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">No prior-year data available for comparison.</div>
        )}
      </div>
    </div>
  );
}
