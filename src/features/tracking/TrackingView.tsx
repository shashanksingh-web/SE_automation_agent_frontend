import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X, XCircle } from "lucide-react";
import { useAbms, useSEs } from "@/shared/api/hooks/useDirectory";
import { useReconcileOutcomes, useTracking } from "@/shared/api/hooks/useTracking";
import { MultiSelectPopover } from "@/shared/components/MultiSelectPopover";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { cn } from "@/shared/lib/cn";
import type { TrackingResponse, TrackingSERow } from "@/shared/types/tracking";

// Tracking dashboard (added 2026-09-16, explicit user request: "according to this
// whole project what we have to track" -> "design this dashboard in this"). Three
// tiers, most important first - Outcomes, Adoption, Quality (Data health and Ops were
// tiers 4 and 5 until 2026-09-17, removed per direct instruction: this is the business
// view of the system, not its operations console) - each a
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

function Section({ n, title, blurb, networkWide, children }: { n: number; title: string; blurb: string; networkWide?: boolean; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {n}. {title}
          {networkWide && (
            <Badge variant="outline" className="font-normal" title="This tier describes the pipeline as a whole - the SE/ABM filter doesn't apply to it">
              Network-wide
            </Badge>
          )}
        </h2>
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
// Visit execution: under half the planned visits happening is the headline problem;
// 50-70% is still a lot of missed visits; 70%+ is healthy. Status and label come from
// the same rule so the chip's colour and its words can't disagree.
function executionStatus(rate: number | null): { status: Status; label: string } {
  if (rate === null) return { status: "warning", label: "Not measured" };
  if (rate < 50) return { status: "critical", label: "Most visits missed" };
  if (rate < 70) return { status: "warning", label: "Many visits missed" };
  return { status: "good", label: "Healthy" };
}

function pctStatus(pct: number | null, warnAbove: number, critAbove?: number): Status {
  if (pct === null) return "warning";
  if (critAbove !== undefined && pct > critAbove) return "critical";
  return pct > warnAbove ? "warning" : "good";
}

// --- the view -----------------------------------------------------------------------
export function TrackingView() {
  const [kind, setKind] = useState<WindowKind>("7");
  const [custom, setCustom] = useState(() => presetRange("custom"));
  // SE/ABM filter (added 2026-09-16, explicit user request: "add SE and ABM wise
  // tracking ... selection must be multiple select"). Local to this view, not the
  // global scope store - it's a lens on the dashboard, not a plan-generation scope.
  const [ses, setSes] = useState<string[]>([]);
  const [abms, setAbms] = useState<string[]>([]);
  const { from, to } = kind === "custom" ? custom : presetRange(kind);
  const { data, isLoading, isError, error, refetch, isFetching } = useTracking(from, to, ses, abms);
  const abmsQuery = useAbms();
  const sesQuery = useSEs();
  const filtered = ses.length > 0 || abms.length > 0;

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

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectPopover
          options={(abmsQuery.data ?? []).map((a) => ({ value: a.code, label: a.name ?? a.code, sublabel: `${a.code} · ${a.dc_count} DCs` }))}
          selected={abms}
          onChange={setAbms}
          placeholder="ABM(s)"
          loading={abmsQuery.isLoading}
        />
        <MultiSelectPopover
          options={(sesQuery.data ?? []).map((s) => ({ value: s.se_email, label: s.se_email, sublabel: s.emp_id_se ? `${s.emp_id_se} · ${s.dc_count} DCs` : `${s.dc_count} DCs` }))}
          selected={ses}
          onChange={setSes}
          placeholder="SE(s)"
          loading={sesQuery.isLoading}
        />
        {filtered && (
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setSes([]); setAbms([]); }}>
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
        {!filtered && <span className="text-xs text-muted-foreground">Network-wide - pick ABMs or SEs to see their outcomes and adoption</span>}
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

// One row per selected SE, outcomes and adoption side by side - the "which of my
// SEs is executing" view an ABM wants. Doubles as the table view for the tier.
function BySETable({ rows }: { rows: TrackingSERow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SE</TableHead>
            <TableHead className="text-right" title="Distinct planned visits in the window">Planned</TableHead>
            <TableHead className="text-right" title="Planned visits whose day has passed">Due</TableHead>
            <TableHead className="text-right" title="Due visits with a recorded outcome">Reconciled</TableHead>
            <TableHead className="text-right" title="Completed or ordered-without-visit, of due">Executed</TableHead>
            <TableHead className="text-right" title="Paid within 2 days of the visit">Collected</TableHead>
            <TableHead className="text-right" title="Ordered within 2 days of the visit">Ordered</TableHead>
            <TableHead className="text-right" title="Days the SE had a plan in their own view">SE-days</TableHead>
            <TableHead className="text-right" title="Accepted / rejected SE-days">Reviewed</TableHead>
            <TableHead className="text-right" title="SE-days with a DC added or removed">Edited</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const exec = r.Execution_Rate_Pct;
            return (
              <TableRow key={r.SE}>
                <TableCell className="font-medium">
                  <div className="whitespace-nowrap">{r.SE}</div>
                  {r.Planned > 0 && r.SE_Days === 0 && (
                    <div className="text-xs font-normal text-muted-foreground" title="Planned by an ABM/state-scope run; the SE never opened their own view">never opened own plan</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.Planned.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right tabular-nums">{r.Due.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right tabular-nums">{r.Reconciled.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {exec === null ? "—" : (
                    <span className="inline-flex items-center justify-end gap-1.5" title={`${r.Executed} of ${r.Due} due`}>
                      {fmtPct(exec)}
                      <span className={cn("inline-block h-2 w-2 rounded-full", exec >= 70 ? "bg-primary" : exec >= 50 ? "bg-warning" : "bg-destructive")} aria-hidden="true" />
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtINR(r.Collection || null)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtINR(r.Sales || null)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.SE_Days}{r.Runs > r.SE_Days && <span className="text-xs text-muted-foreground"> ({r.Runs} runs)</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{r.Approved + r.Rejected}{r.Rejected > 0 && <span className="text-xs text-muted-foreground"> ({r.Rejected} rej.)</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{r.Edited_Days}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Tiers({ data }: { data: TrackingResponse }) {
  const { Window: win, Outcomes: o, Adoption: a, Quality: q } = data;
  const sel = win.Selection;
  const neverReconciled = o.Tasks_Reconciled === 0;
  const latency = q.Generation_Latency_Sec;

  return (
    <div className="space-y-8">
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>
          {win.Plan_Runs.toLocaleString("en-IN")} plan runs dated {fmtRange(win.From, win.To)} ({win.Days} day{win.Days === 1 ? "" : "s"}) · computed {fmtWhen(data.Generated_At)}
        </div>
        {sel && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              Filtered to {sel.Resolved_SEs} SE{sel.Resolved_SEs === 1 ? "" : "s"}
              {sel.ABMs.length > 0 && ` · ${sel.SEs_Via_ABM} via ${sel.ABMs.length} ABM${sel.ABMs.length === 1 ? "" : "s"}`}
            </Badge>
            {sel.Unmatched_ABMs.length > 0 && (
              <StatusChip status="warning" label={`No SEs on file for ABM ${sel.Unmatched_ABMs.join(", ")}`} />
            )}
            <span>Outcomes and Adoption below are for this selection; Quality stays network-wide.</span>
          </div>
        )}
      </div>

      <Section n={1} title="Outcomes" blurb="Does the plan change what SEs collect and sell. Counted per planned visit (one SE, one DC, one day) - a regenerated plan doesn't count twice. Execution = (completed + ordered without a visit) ÷ planned visits whose day has passed; a past visit nobody reconciled counts as not executed. Only reconciliation writes these.">
        <ReconcileRow outcomes={o} />
        <Grid>
          <Tile
            hero
            label={neverReconciled ? "Visits reconciled" : "Visit execution rate"}
            value={neverReconciled ? `${o.Tasks_Reconciled} / ${fmtNum(o.Tasks_Due)}` : fmtPct(o.Visit_Execution_Rate_Pct)}
            hint={neverReconciled ? "planned visits with a recorded outcome" : `${fmtNum(o.Outcome_Status_Breakdown.COMPLETED ?? 0)} completed + ${fmtNum(o.Outcome_Status_Breakdown.PARTIAL ?? 0)} ordered without a visit, of ${fmtNum(o.Tasks_Due)} planned visits due${o.Tasks_Not_Yet_Due > 0 ? ` · ${fmtNum(o.Tasks_Not_Yet_Due)} more planned for today or later` : ""}`}
            status={neverReconciled ? { status: "critical", label: "Never measured" } : executionStatus(o.Visit_Execution_Rate_Pct)}
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
          <Tile label="Planned visits" value={fmtNum(o.Tasks_Planned)} hint={`${fmtNum(o.Tasks_Due)} due, ${fmtPct(o.Reconciliation_Rate_Pct)} of them reconciled · ${fmtNum(o.Task_Rows)} task rows incl. regenerations`} />
        </Grid>
        {data.By_SE && <BySETable rows={data.By_SE} />}
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

      <Section n={3} title="Quality" networkWide={!!sel} blurb="What the agents produced - the pitch, the products it recommends, and the routes.">
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

    </div>
  );
}
