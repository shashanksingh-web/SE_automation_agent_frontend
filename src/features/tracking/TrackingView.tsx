import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useReconcileOutcomes, useTracking } from "@/shared/api/hooks/useTracking";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/cn";
import type { TrackingResponse } from "@/shared/types/tracking";

// Tracking dashboard (added 2026-09-16, explicit user request: "according to this
// whole project what we have to track" -> "design this dashboard in this"). Five
// tiers, most important first - Outcomes, Adoption, Quality, Data health, Ops - each a
// KPI row of stat tiles plus, where a breakdown adds something, single-hue horizontal
// bars with direct labels. One hero figure per view (the Outcomes headline), status
// chips always icon + label (never color alone), and "never measured" stated outright
// rather than shown as a fabricated 0%. Every number comes from
// GET /admin/tracking/ (planning/tracking.py) - nothing is computed client-side beyond
// formatting, so what this page says and what the API says can't drift.

type Status = "good" | "warning" | "critical";
// Window presets. Everything is an inclusive plan-date range - the day the visits were
// FOR - because "how did yesterday go" means the visits planned for yesterday, not the
// plans generated yesterday. "Custom" exposes from/to inputs (server caps the span at
// 90 days and rejects from > to with a 400 shown inline).
type WindowKind = "yesterday" | "7" | "14" | "30" | "custom";
const WINDOW_PRESETS: Array<{ kind: WindowKind; label: string }> = [
  { kind: "yesterday", label: "Yesterday" },
  { kind: "7", label: "7 days" },
  { kind: "14", label: "14 days" },
  { kind: "30", label: "30 days" },
  { kind: "custom", label: "Custom" },
];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function presetRange(kind: WindowKind): { from: string; to: string } {
  switch (kind) {
    case "yesterday":
      return { from: isoDaysAgo(1), to: isoDaysAgo(1) };
    case "custom":
      return { from: isoDaysAgo(6), to: isoDaysAgo(0) };
    default:
      return { from: isoDaysAgo(Number(kind) - 1), to: isoDaysAgo(0) };
  }
}

function fmtRange(from: string, to: string): string {
  const f = new Date(from + "T00:00:00").toLocaleDateString();
  const t = new Date(to + "T00:00:00").toLocaleDateString();
  return from === to ? f : `${f} – ${t}`;
}

const STATUS_VARIANT: Record<Status, "default" | "warning" | "destructive"> = {
  good: "default",
  warning: "warning",
  critical: "destructive",
};
const STATUS_ICON: Record<Status, typeof CheckCircle2> = {
  good: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
};

// --- formatting -------------------------------------------------------------------
// Proportional figures for standalone values (no tabular-nums - digits look loose at
// display size); compact past 4 digits. Rupees compact to the Indian L/Cr scale.
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-IN");
}
function fmtINR(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
function fmtPct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${n}%`;
}
function fmtWhen(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : "never";
}
function isToday(iso: string | null | undefined): boolean {
  return !!iso && new Date(iso).toDateString() === new Date().toDateString();
}

// --- building blocks --------------------------------------------------------------
function StatusChip({ status, label }: { status: Status; label: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge variant={STATUS_VARIANT[status]} className="gap-1 whitespace-nowrap">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

function Tile({
  label, value, hint, status, hero,
}: { label: string; value: string; hint?: string; status?: { status: Status; label: string }; hero?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-md border bg-card p-3", hero && "sm:col-span-2")}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("font-semibold leading-none", hero ? "text-5xl" : "text-2xl")}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {status && <div className="mt-1"><StatusChip {...status} /></div>}
    </div>
  );
}

// A ratio against a limit: fill in the accent hue, track a lighter step of the same
// hue so state reads across the whole bar; the number is text, never the bar color.
function Meter({ label, pct, hint, status }: { label: string; pct: number | null; hint?: string; status?: { status: Status; label: string } }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{fmtPct(pct)}</div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-primary/15" role="img" aria-label={`${label}: ${fmtPct(pct)}`}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2">
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : <span />}
        {status && <StatusChip {...status} />}
      </div>
    </div>
  );
}

// Single-series magnitude comparison: one hue, direct labels, sorted, top 6 + Other.
// Doubles as the table view - every row is a readable label/number pair.
function Breakdown({ title, data, empty = "Nothing in this window" }: { title: string; data: Record<string, number>; empty?: string }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const shown = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((s, [, n]) => s + n, 0);
  if (rest > 0) shown.push(["Other", rest]);
  const max = Math.max(1, ...shown.map(([, n]) => n));
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {shown.length === 0 ? (
        <div className="text-sm text-muted-foreground">{empty}</div>
      ) : (
        <ul className="space-y-1.5">
          {shown.map(([name, n]) => (
            <li key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-sm">
              <span className="truncate" title={name}>{name.replace(/_/g, " ")}</span>
              <span className="font-medium tabular-nums">{n.toLocaleString("en-IN")}</span>
              <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-primary/15">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(100 * n) / max}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({ n, title, blurb, children }: { n: number; title: string; blurb: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{n}. {title}</h2>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
);

// --- status rules (the thresholds are the dashboard's opinion, stated once here) -----
function pctStatus(pct: number | null, warnAbove: number, critAbove?: number): Status {
  if (pct === null) return "warning";
  if (critAbove !== undefined && pct > critAbove) return "critical";
  return pct > warnAbove ? "warning" : "good";
}

// --- the view -----------------------------------------------------------------------
export function TrackingView() {
  const [kind, setKind] = useState<WindowKind>("7");
  const [custom, setCustom] = useState(() => presetRange("custom"));
  const { from, to } = kind === "custom" ? custom : presetRange(kind);
  const { data, isLoading, isError, error, refetch, isFetching } = useTracking(from, to);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Tracking</h1>
          <p className="text-sm text-muted-foreground">
            What the planning system is producing, and whether it changes what SEs collect and sell.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border bg-background p-1" title="Plans dated within this range">
            {WINDOW_PRESETS.map((w) => (
              <Button key={w.kind} size="sm" variant={kind === w.kind ? "default" : "ghost"} className="h-7 px-2" onClick={() => setKind(w.kind)}>
                {w.label}
              </Button>
            ))}
          </div>
          {kind === "custom" && (
            <div className="flex items-center gap-1">
              <Input type="date" className="h-8 w-36" value={custom.from} max={custom.to} aria-label="From date" onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" className="h-8 w-36" value={custom.to} min={custom.from} aria-label="To date" onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </div>
          )}
          <Button size="sm" variant="outline" className="h-9" onClick={() => refetch()} disabled={isFetching} title="Recompute now">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Computing metrics for {fmtRange(from, to)}...
        </div>
      )}
      {isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load tracking metrics."}
        </div>
      )}
      {data && <Tiers data={data} />}
    </div>
  );
}

// Reconciliation status + the manual trigger. Reconciliation also runs on its own
// inside every plan generation (for that scope's SEs), so this row is normally quiet;
// the button matters for a backlog - the first ever run, or after days with no
// generations - and for an admin who wants yesterday's numbers before anyone has
// opened today's plan.
function ReconcileRow({ outcomes: o }: { outcomes: TrackingResponse["Outcomes"] }) {
  const reconcile = useReconcileOutcomes();
  const never = o.Tasks_Reconciled === 0 && !o.Reconciliation_Last_Run_At;
  const pending = o.Reconcilable_Now;
  const tone = never ? "border-destructive/40 bg-destructive/10" : pending > 0 ? "border-warning/60 bg-warning/10" : "border bg-card";
  const Icon = never ? XCircle : pending > 0 ? AlertTriangle : CheckCircle2;
  const result = reconcile.data;
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm", tone)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", never ? "text-destructive" : pending > 0 ? "text-warning-foreground" : "text-muted-foreground")} aria-hidden="true" />
        <div>
          {never ? (
            <span className="font-medium">Outcome reconciliation has never run.</span>
          ) : (
            <span className="font-medium">Reconciliation last ran {fmtWhen(o.Reconciliation_Last_Run_At)}.</span>
          )}{" "}
          {pending > 0
            ? `${pending.toLocaleString("en-IN")} past task rows have no outcome recorded yet.`
            : "Every past planned visit has an outcome recorded. It also runs automatically each time a plan is generated."}
          {result && (
            <div className="mt-1 text-xs text-muted-foreground">
              Just now: {result.Tasks.toLocaleString("en-IN")} task rows over {result.Dates} day{result.Dates === 1 ? "" : "s"} -{" "}
              {result.Completed} completed, {result.Partial} partial, {result.Missed} missed, {fmtINR(result.Payment_Amount)} collected
              {result.Pull_Failures.length > 0 && ` · ${result.Pull_Failures.length} live pull(s) failed`}.
            </div>
          )}
          {reconcile.isError && (
            <div className="mt-1 text-xs text-destructive">
              {reconcile.error instanceof Error ? reconcile.error.message : "Reconciliation failed."}
            </div>
          )}
        </div>
      </div>
      <Button size="sm" variant={pending > 0 ? "default" : "outline"} className="h-8" onClick={() => reconcile.mutate()} disabled={reconcile.isPending} title="Reconcile every past planned visit that still has no outcome, network-wide">
        {reconcile.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
        {reconcile.isPending ? "Reconciling..." : pending > 0 ? `Reconcile ${pending.toLocaleString("en-IN")} now` : "Reconcile now"}
      </Button>
    </div>
  );
}

function Tiers({ data }: { data: TrackingResponse }) {
  const { Window: win, Outcomes: o, Adoption: a, Quality: q, Data_Health: d, Ops: ops } = data;
  const neverReconciled = o.Tasks_Reconciled === 0;
  const latency = q.Generation_Latency_Sec;

  return (
    <div className="space-y-8">
      <div className="text-xs text-muted-foreground">
        {win.Plan_Runs.toLocaleString("en-IN")} plan runs dated {fmtRange(win.From, win.To)} ({win.Days} day{win.Days === 1 ? "" : "s"}) · computed {fmtWhen(data.Generated_At)}
      </div>

      <Section n={1} title="Outcomes" blurb="Does the plan change what SEs collect and sell. Counted per planned visit (one SE, one DC, one day) - a regenerated plan doesn't count twice. Only reconciliation writes these; everything else on this page is upstream of it.">
        <ReconcileRow outcomes={o} />
        <Grid>
          <Tile
            hero
            label={neverReconciled ? "Visits reconciled" : "Visit execution rate"}
            value={neverReconciled ? `${o.Tasks_Reconciled} / ${fmtNum(o.Tasks_Planned)}` : fmtPct(o.Visit_Execution_Rate_Pct)}
            hint={neverReconciled ? "planned visits with a recorded outcome" : `${fmtNum(o.Outcome_Status_Breakdown.COMPLETED ?? 0)} completed + ${fmtNum(o.Outcome_Status_Breakdown.PARTIAL ?? 0)} ordered without a visit, of ${fmtNum(o.Tasks_Reconciled)} reconciled visits`}
            status={neverReconciled ? { status: "critical", label: "Never measured" } : { status: pctStatus(100 - (o.Visit_Execution_Rate_Pct ?? 0), 30, 50), label: (o.Visit_Execution_Rate_Pct ?? 0) < 50 ? "Most visits missed" : "Healthy" }}
          />
          <Tile label="Collection realised" value={fmtINR(o.Collection_Realised)} hint={`paid within 2 days of the visit · ${fmtINR(o.Overdue_Pitched)} overdue pitched`} />
          <Tile label="Sales after visit" value={fmtINR(o.Sales_After_Visit)} hint="ordered within 2 days of the visit" />
          <Tile label="Promises to pay" value={fmtNum(o.PTP_Promises)} hint={`${fmtINR(o.PTP_Promised_Amount)} promised`} />
          <Tile
            label="Chronic non-execution"
            value={fmtNum(o.Chronic_Non_Execution_Pairs)}
            hint={`SE–DC pairs missed ${o.Escalation_Threshold_Misses}+ days running (all time)`}
            status={{ status: o.Chronic_Non_Execution_Pairs > 0 ? "warning" : "good", label: o.Chronic_Non_Execution_Pairs > 0 ? "Escalated" : "None" }}
          />
          <Tile label="Planned visits" value={fmtNum(o.Tasks_Planned)} hint={`${fmtPct(o.Reconciliation_Rate_Pct)} reconciled · ${fmtNum(o.Task_Rows)} task rows incl. regenerations`} />
        </Grid>
      </Section>

      <Section n={2} title="Adoption" blurb="Do SEs accept the plan or fight it. Counted per SE-day (one SE, one plan date) - an SE reviews one plan a day, however many times it was regenerated. A day's verdict is its latest review.">
        <Grid>
          <Tile label="SE-days planned" value={fmtNum(a.SE_Days)} hint={`${fmtNum(a.SE_Runs)} SE plan runs · ${fmtNum(a.Plan_Runs)} runs across all scopes`} />
          <Tile
            label="Reviewed by the SE"
            value={fmtPct(a.Reviewed_Rate_Pct)}
            hint={`${a.Approved} accepted · ${a.Rejected} rejected · ${a.By_Status.PENDING_REVIEW ?? 0} never reviewed`}
            status={{ status: (a.Reviewed_Rate_Pct ?? 0) < 20 ? "warning" : "good", label: (a.Reviewed_Rate_Pct ?? 0) < 20 ? "Low" : "Healthy" }}
          />
          <Tile
            label="Days with route edits"
            value={fmtPct(a.Manual_Edit_Rate_Pct)}
            hint={`${a.Manually_Edited_Days} of ${a.SE_Days} SE-days had a DC added or removed`}
            status={{ status: pctStatus(a.Manual_Edit_Rate_Pct ?? 0, 25, 50), label: (a.Manual_Edit_Rate_Pct ?? 0) > 25 ? "SEs overriding" : "Trusted" }}
          />
          <Tile
            label="Regenerations per SE-day"
            value={a.Runs_Per_SE_Day === null ? "—" : `${a.Runs_Per_SE_Day}×`}
            hint="every view load rebuilds the plan - each one a full pipeline run"
            status={{ status: (a.Runs_Per_SE_Day ?? 0) > 3 ? "warning" : "good", label: (a.Runs_Per_SE_Day ?? 0) > 3 ? "Heavy churn" : "OK" }}
          />
        </Grid>
        <div className="grid gap-3 sm:grid-cols-2">
          <Breakdown title="SE-day verdict" data={a.By_Status} />
          <Breakdown title="Route model of record" data={a.Selected_Plan_Type_Breakdown} />
        </div>
      </Section>

      <Section n={3} title="Quality" blurb="What the agents produced - the pitch, the products it recommends, and the routes.">
        <Grid>
          <Tile
            label="AI-generated pitches"
            value={fmtPct(q.AI_Share_Pct)}
            hint={`${fmtNum(q.Pitches_AI)} AI · ${fmtNum(q.Pitches_Template)} template fallback`}
            status={{ status: q.Pitches_AI === 0 ? "critical" : (q.AI_Share_Pct ?? 0) < 50 ? "warning" : "good", label: q.Pitches_AI === 0 ? "AI down" : (q.AI_Share_Pct ?? 0) < 50 ? "Fallback dominant" : "Healthy" }}
          />
          <Tile label="Hallucinated products caught" value={fmtNum(q.Hallucinated_Products_Dropped)} hint="model picks not in the DC's real candidate pool, dropped" />
          <Tile
            label="Pitches with no recommendation"
            value={fmtPct(q.Empty_Recommendation_Pct)}
            status={{ status: pctStatus(q.Empty_Recommendation_Pct, 5, 20), label: (q.Empty_Recommendation_Pct ?? 0) > 5 ? "Check nearby data" : "Healthy" }}
          />
          <Tile
            label="Products with benefit text"
            value={fmtPct(q.Benefit_Text_Coverage_Pct)}
            hint="recommended products carrying a product-master description"
            status={{ status: (q.Benefit_Text_Coverage_Pct ?? 0) < 50 ? "warning" : "good", label: (q.Benefit_Text_Coverage_Pct ?? 0) < 50 ? "Master data gap" : "Healthy" }}
          />
        </Grid>
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <Meter
            label="Routes over budget (80 km / 180 min)"
            pct={q.Routes_Over_Budget_Pct}
            hint={`${fmtNum(q.Routes_Over_Budget)} of ${fmtNum(q.Route_Plans)} · avg ${q.Route_Avg_Distance_Km ?? "—"} km, ${q.Route_Avg_Minutes ?? "—"} min`}
            status={{ status: pctStatus(q.Routes_Over_Budget_Pct, 25, 50), label: (q.Routes_Over_Budget_Pct ?? 0) > 25 ? "Budget not held" : "Within budget" }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Plans converged" value={fmtNum(q.Plans_Converged)} hint="all 3 routes identical despite room to differ" />
            <Tile label="Thin candidate pools" value={fmtNum(q.Insufficient_Candidates)} hint="too few eligible DCs for 3 distinct routes" />
            <Tile
              label="Generation time"
              value={latency.Avg === null ? "—" : `${latency.Avg}s`}
              hint={`P90 ${latency.P90 ?? "—"}s · max ${latency.Max ?? "—"}s · ${latency.Runs} runs`}
              status={{ status: (latency.P90 ?? 0) > 120 ? "warning" : "good", label: (latency.P90 ?? 0) > 120 ? "Slow" : "OK" }}
            />
          </div>
        </div>
      </Section>

      <Section n={4} title="Data health" blurb="Is the data feeding all of the above intact. Only real failures count here - a DC excluded by policy is logged by design, not a problem.">
        <Grid>
          <Tile
            label="Runs hit by a live-pull failure"
            value={fmtPct(d.Runs_With_A_Failure_Pct)}
            hint={`${d.Runs_With_A_Failure} of ${win.Plan_Runs} runs`}
            status={{ status: pctStatus(d.Runs_With_A_Failure_Pct, 10, 30), label: (d.Runs_With_A_Failure_Pct ?? 0) > 10 ? "Degraded" : "Healthy" }}
          />
          <Tile label="Real failures" value={fmtNum(d.Exceptions_Failures)} hint={`of ${fmtNum(d.Exceptions_Total)} exception records · ${fmtNum(d.Exceptions_Structural)} structural (by design)`} />
          <Tile
            label="Normalization last run"
            value={isToday(d.Normalization_Last_Run_At) ? "Today" : d.Normalization_Last_Run_At ? new Date(d.Normalization_Last_Run_At).toLocaleDateString() : "—"}
            hint={fmtWhen(d.Normalization_Last_Run_At)}
            status={{ status: isToday(d.Normalization_Last_Run_At) ? "good" : "warning", label: isToday(d.Normalization_Last_Run_At) ? "Fresh" : "Stale" }}
          />
          <Tile
            label="DC master with coordinates"
            value={fmtPct(d.DC_Master_Geo_Coverage_Pct)}
            hint={`${fmtNum(d.DC_Master_Rows)} DCs in the static master; live geo covers the rest · ${d.Scheduled_Scopes} scheduled scopes`}
            status={{ status: (d.DC_Master_Geo_Coverage_Pct ?? 0) < 70 ? "warning" : "good", label: (d.DC_Master_Geo_Coverage_Pct ?? 0) < 70 ? "Partial" : "Healthy" }}
          />
        </Grid>
        <div className="grid gap-3 sm:grid-cols-2">
          <Breakdown title="Live-pull failures by source" data={d.Live_Pull_Failures_By_Source} empty="No live-pull failures in this window" />
          <Breakdown title="Structural exceptions (expected, by design)" data={d.Top_Structural_Codes} />
        </div>
      </Section>

      <Section n={5} title="Ops" blurb="The plumbing underneath.">
        <Grid>
          <Tile
            label="Alert routing"
            value={ops.Alert_Webhook_Configured ? "Configured" : "Not configured"}
            hint="ALERT_WEBHOOK_URL - where run-health alerts are sent"
            status={ops.Alert_Webhook_Configured ? { status: "good", label: "Alerts delivered" } : { status: "critical", label: "Alerts go nowhere" }}
          />
          <Tile
            label="Redshift"
            value={ops.Redshift_Reachable === null ? "Not configured" : ops.Redshift_Reachable ? "Reachable" : "Unreachable"}
            hint="live data source for every generation"
            status={ops.Redshift_Reachable === false ? { status: "critical", label: "Generation blocked" } : ops.Redshift_Reachable ? { status: "good", label: "Connected" } : { status: "warning", label: "No host set" }}
          />
          <Tile label="Database" value={`${ops.DB_Journal_Mode.toUpperCase()} · ${ops.DB_Transaction_Mode ?? "—"}`} hint={`busy timeout ${ops.DB_Busy_Timeout_Sec ?? "—"}s`} />
          <Tile label="Weekly off day" value={ops.Plan_Generation_Weekly_Off_Day ?? "None"} hint="no plans generated on this day" />
        </Grid>
      </Section>
    </div>
  );
}
