import { Package } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import type { RecommendedProductItem } from "@/shared/types/feedback";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const SCOPE_LABEL: Record<string, string> = {
  node: "Node-level comparison",
  nearby_radius: "Nearby DCs (200km)",
  nearby_node: "Nearby nodes",
};

const SCOPE_TITLE: Record<string, string> = {
  node: "This DC's own block had no peers with purchase data, so this widened to node-level peers instead - a less locally-relevant comparison than block would be.",
  nearby_radius: "This DC's own block and node peers had no purchase data at all, so this widened to every DC within 200km instead - not necessarily the same category this DC sells.",
  nearby_node: "Even a 200km radius search found nothing, so this widened to the nearest Nodes by distance instead - the weakest signal in this fallback chain.",
};

// Up to 5 products pulled out of the Hindi prose into their own labeled card - same
// component for both PitchResponse (any segment) and DCCardResponse (PRIVATE LABEL
// only - see RecommendedProducts' own doc comment for why the two lists can genuinely
// differ). Widened 2026-08-18 from a single top product per direct instruction; []
// when this DC had nothing to recommend this run, even after the geographic fallback.
// Scope is uniform across the whole list (services.py tags every item from one
// _peer_stats/geo-fallback call the same way), so one badge in the header covers all
// of them rather than repeating per item.
export function RecommendedProductCard({ products }: { products: RecommendedProductItem[] }) {
  if (!products || products.length === 0) return null;
  const scope = products[0].Scope;

  return (
    <div className="rounded-md border bg-accent/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          Recommended products
        </div>
        {scope && SCOPE_LABEL[scope] && (
          <Badge variant="warning" title={SCOPE_TITLE[scope]}>
            {SCOPE_LABEL[scope]}
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        {products.map((p, i) => (
          <div key={`${p.Product_Name}-${i}`} className={i > 0 ? "border-t pt-2" : undefined}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{p.Product_Name}</div>
              {p.Value != null && (
                <div className="text-xs text-muted-foreground">{currencyFormatter.format(p.Value)}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Field label="Category" value={p.Category} />
              <Field label="Sub-category" value={p.Sub_Category} />
              <Field label="Brand" value={p.Brand} />
              <Field label="Segment" value={p.Business_Segment} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}: </span>
      <span className="text-xs">{value}</span>
    </div>
  );
}
