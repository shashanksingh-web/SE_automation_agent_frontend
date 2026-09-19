import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useDiscountSchemes, useRefreshDiscountSchemes } from "@/shared/api/hooks/useDiscountSchemes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import type { DiscountScheme } from "@/shared/types/discountSchemes";

// Discount Schemes (added 2026-09-19, matching the backend's admin_discount_schemes
// endpoint from the same day) - the live "present status" of every active DC-facing
// scheme on the Discount Service. Read-only. This is NOT what the pitch pipeline
// reads at generation time (that's its own once-a-day pull, see planning/services.py
// _fetch_live_discount_schemes) - it's the admin's way to check, right now, which
// schemes the service itself says are live, e.g. when a pitch mentions a scheme the
// field says has ended. The backend caches the pull for an hour; Refresh forces a
// live one.

const ALL = "__all__";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function maxPerDc(value: DiscountScheme["max_discount_per_dc"]): string {
  if (value == null || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? currencyFormatter.format(n) : String(value);
}

function bookingEnd(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// "Jharkhand,Uttar Pradesh,Bihar" -> ["Jharkhand", "Uttar Pradesh", "Bihar"]
function splitNames(raw: string | null): string[] {
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export function DiscountSchemesPanel() {
  const { data, isLoading, isError, error } = useDiscountSchemes();
  const refresh = useRefreshDiscountSchemes();
  const [search, setSearch] = useState("");
  const [state, setState] = useState(ALL);
  const [type, setType] = useState(ALL);

  const schemes = useMemo(() => data?.Schemes ?? [], [data]);

  const states = useMemo(() => {
    const set = new Set<string>();
    schemes.forEach((s) => splitNames(s.state_names_raw).forEach((n) => set.add(n)));
    return [...set].sort();
  }, [schemes]);

  const types = useMemo(() => [...new Set(schemes.map((s) => s.scheme_type).filter((t): t is string => !!t))].sort(), [schemes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schemes.filter((s) => {
      if (state !== ALL && !splitNames(s.state_names_raw).includes(state)) return false;
      if (type !== ALL && s.scheme_type !== type) return false;
      if (!q) return true;
      return [s.scheme_name, s.generated_description, s.node_names_raw, s.state_names_raw, String(s.scheme_id ?? "")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [schemes, search, state, type]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading live scheme status...
      </div>
    );
  }
  if (isError || !data) {
    return <p className="py-8 text-sm text-destructive">Could not load discount schemes{error instanceof Error ? `: ${error.message}` : ""}.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Discount Schemes</CardTitle>
            <CardDescription>
              What the Discount Service says is live right now - {schemes.length} active scheme{schemes.length === 1 ? "" : "s"}, fetched{" "}
              {new Date(data.Fetched_At).toLocaleString()}. Pitches use their own once-a-day pull, so a scheme can differ here until the
              next plan generation.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
        {refresh.isError && <p className="text-xs text-destructive">Refresh failed - showing the last fetched list.</p>}
        {data.Exceptions.length > 0 && (
          <div className="space-y-1 rounded-md border border-warning-foreground/30 bg-warning/10 px-3 py-2 text-xs">
            {data.Exceptions.map((e, i) => (
              <p key={i}>
                <span className="font-medium">{e.reason_code}</span>: {e.detail}
              </p>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, description, node, state, id"
            className="h-9 w-full sm:w-72"
          />
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="h-9 w-full sm:w-48">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All states</SelectItem>
              {states.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 w-full sm:w-56">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filtered.length === schemes.length ? `${schemes.length} schemes` : `${filtered.length} of ${schemes.length} schemes`}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No scheme matches these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Scheme</TableHead>
                  <TableHead>Where</TableHead>
                  <TableHead className="min-w-[24rem]">What the DC gets</TableHead>
                  <TableHead className="whitespace-nowrap">Booking ends</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Max / DC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const stateNames = splitNames(s.state_names_raw);
                  const nodeNames = splitNames(s.node_names_raw);
                  return (
                    <TableRow key={s.scheme_id ?? s.scheme_name ?? Math.random()}>
                      <TableCell className="align-top tabular-nums text-muted-foreground">{s.scheme_id ?? "-"}</TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium">{s.scheme_name ?? "-"}</div>
                        {s.scheme_type && (
                          <Badge variant="secondary" className="mt-1 font-normal">
                            {s.scheme_type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-xs">
                        {stateNames.length > 0 && <div>{stateNames.join(", ")}</div>}
                        {nodeNames.length > 0 && <div className="text-muted-foreground">{nodeNames.join(", ")}</div>}
                        {stateNames.length === 0 && nodeNames.length === 0 && <span className="text-muted-foreground">Everywhere</span>}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">{s.generated_description ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap align-top text-xs">{bookingEnd(s.booking_end)}</TableCell>
                      <TableCell className="whitespace-nowrap align-top text-right tabular-nums">{maxPerDc(s.max_discount_per_dc)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
