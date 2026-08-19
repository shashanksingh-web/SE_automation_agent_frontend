import { useState, useEffect, Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight, MessageSquareText, Route, IdCard } from "lucide-react";
import type { Task, ClubDetail } from "@/shared/types/planRun";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { taskTypeHasNoPitch } from "@/shared/api/hooks/usePitch";
import { useSEs } from "@/shared/api/hooks/useDirectory";
import { cn } from "@/shared/lib/cn";
import { rememberDCName, getCachedDCName } from "@/shared/lib/dcNameCache";

interface TaskTableProps {
  seId: string;
  seName: string;
  tasks: Task[];
  onOpenPitch: (task: Task) => void;
  onOpenDCCard: (task: Task) => void;
  onOpenRoutes: (seId: string, dcNames: Record<string, string>) => void;
}

// Daily task table (Plans[].Tasks[], §7). Actuals are empty for future/unreconciled
// dates, so the planned-vs-actual block renders as an expandable second row per
// task (the OutcomePanel concern, §7/§18) instead of always-visible columns.
export function TaskTable({ seId, seName, tasks, onOpenPitch, onOpenDCCard, onOpenRoutes }: TaskTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // SEDirectoryEntry has no display name (se_email is the only identifier, see that
  // type's own comment) but does carry nodes[] - an SE can genuinely cover more than
  // one, so this joins all of them rather than picking just the first. Matched on
  // seName, not seId - SE_Name (planning/views.py: se_name or se_id) is the SE's email
  // in practice, the same identifier SEDirectoryEntry.se_email uses; SE_ID here is a
  // separate numeric employee code that never appears in the directory at all.
  // Unfiltered call (no state/node args) so it's a cache hit off whatever
  // ScopeSelector already loaded, not a second network round trip.
  const { data: seDirectory } = useSEs();
  const seNodes = seDirectory?.find((s) => s.se_email === seName)?.nodes ?? [];

  // Warm the DC-name cache from whatever real names this render has, so a later
  // resynced task (DC_Name null after a route selection, see dcNameCache.ts) can still
  // fall back to a name we already saw for the same DC_ID earlier this session.
  useEffect(() => {
    tasks.forEach((t) => rememberDCName(t.DC_ID, t.DC_Name));
  }, [tasks]);

  const toggle = (dcId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(dcId) ? next.delete(dcId) : next.add(dcId);
      return next;
    });
  };

  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
        <div className="text-sm font-medium">
          {seName}
          {seNodes.length > 0 && <span className="text-muted-foreground"> - {seNodes.join(", ")}</span>}{" "}
          <span className="text-muted-foreground">({tasks.length} tasks)</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onOpenRoutes(
              seId,
              Object.fromEntries(
                tasks.map((t) => [t.DC_ID, t.DC_Name ?? getCachedDCName(t.DC_ID) ?? t.DC_ID]),
              ),
            )
          }
          className="gap-1.5"
        >
          <Route className="h-3.5 w-3.5" />
          Route plans
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-6" />
            <TableHead>DC</TableHead>
            <TableHead>Task type</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Distance</TableHead>
            <TableHead>Overdue</TableHead>
            <TableHead>Last visit</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isExpanded = expanded.has(task.DC_ID);
            const hasReconciliation = !!task.Reconciled_At;
            const noPitch = taskTypeHasNoPitch(task.Recommended_Task_Type);
            return (
              <Fragment key={task.DC_ID}>
                <TableRow className="cursor-pointer" onClick={() => toggle(task.DC_ID)}>
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      {task.DC_Name ?? getCachedDCName(task.DC_ID) ?? `DC ${task.DC_ID}`}
                      {task.Critical && (
                        <Badge variant="destructive" title={task.Critical_Reasons || undefined}>
                          Critical
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{task.Recommended_Task_Type}</TableCell>
                  <TableCell className="max-w-[16rem] truncate">{task.Purpose_Of_Visit}</TableCell>
                  <TableCell>{task.Distance_Km != null ? `${task.Distance_Km} km` : "-"}</TableCell>
                  <TableCell>
                    {task.Overdue_Aging_Bucket ? (
                      <Badge variant="warning">{task.Overdue_Aging_Bucket}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.Last_Visit_Date ?? "never"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">
                    {!noPitch && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Dehaat Center Ko Jaano (DC card)"
                          onClick={() =>
                            onOpenDCCard(
                              task.DC_Name
                                ? task
                                : { ...task, DC_Name: getCachedDCName(task.DC_ID) ?? task.DC_Name },
                            )
                          }
                        >
                          <IdCard className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="View pitch script"
                          onClick={() =>
                            onOpenPitch(
                              task.DC_Name
                                ? task
                                : { ...task, DC_Name: getCachedDCName(task.DC_ID) ?? task.DC_Name },
                            )
                          }
                        >
                          <MessageSquareText className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell />
                    <TableCell colSpan={7}>
                      <TaskDetailRow task={task} hasReconciliation={hasReconciliation} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {tasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                No tasks for this SE on the selected date.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? "-"}</div>
    </div>
  );
}

// Structured breakdown of Club_Detail (se_daily_plan_agent.normalize_dc_club(),
// confirmed 2026-08-19) - DC_Club_Participation's one-line prose already carries this
// same data, this pulls it into its own callout for two questions a plain string
// answers less clearly: "if enrolled and outstanding is clear, where do they actually
// stand" (Club_Tier set - current tier/zone/TOD%/reward) and "if outstanding gets
// cleared, which scheme would they be eligible for and what's the benefit"
// (Eligible_Tier_If_Outstanding_Cleared set - the pitch opportunity). The two are
// mutually exclusive - a DC is either already tiered, or working towards one, never both.
function ClubStandingDetail({ club }: { club: ClubDetail | null }) {
  if (!club) return null;

  if (club.Club_Tier) {
    return (
      <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-primary">Current club standing:</span>{" "}
        {club.Club_Tier} tier
        {club.Zone && `, ${club.Zone} zone`}
        {club.TOD_Percent != null && `, ${club.TOD_Percent.toFixed(2)}% TOD`}
        {club.Reward && ` - ${club.Reward}`}
      </div>
    );
  }

  if (club.Eligible_Tier_If_Outstanding_Cleared) {
    return (
      <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
        <span className="font-semibold uppercase tracking-wide">If outstanding cleared - pitch point:</span>{" "}
        eligible for {club.Eligible_Tier_If_Outstanding_Cleared} tier
        {club.Eligible_Tier_TOD_Percent_If_Cleared != null && `, ${club.Eligible_Tier_TOD_Percent_If_Cleared.toFixed(2)}% TOD`}
        {club.Eligible_Tier_Reward_If_Cleared && ` - ${club.Eligible_Tier_Reward_If_Cleared}`}
      </div>
    );
  }

  // Enrolled, but not close enough for ANY tier yet - not even clearing outstanding
  // would unlock one (fixed 2026-08-19: this used to render nothing at all here,
  // leaving turnover-too-low and outstanding-not-cleared indistinguishable from each
  // other in the UI, even though DC_Club_Participation's own text already separates
  // them). Turnover is the real gap here, not outstanding - see that field for detail.
  if (club.Is_Club_Enrolled) {
    return (
      <div className="sm:col-span-2 lg:col-span-4 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Not yet eligible for any tier:</span>{" "}
        {club.Qualifying_Turnover != null
          ? `qualifying turnover ₹${club.Qualifying_Turnover.toLocaleString("en-IN")} this scheme year - below Copper's entry threshold.`
          : "no qualifying turnover recorded this scheme year."}
      </div>
    );
  }

  return null;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// Present_Outstanding/Present_Overdue/Last_Order_Value/YTD_Private_Label/Actual_Order_Value/
// Actual_Payment_Amount are all raw rupee amounts with no unit attached anywhere in the API
// response - rendered as a bare number they're genuinely ambiguous (a "69360" next to an
// order date reads as an id, not ₹69,360). Format every money field through this.
function formatCurrency(value: number | null | undefined): string | undefined {
  return value == null ? undefined : currencyFormatter.format(value);
}

// Reason_Of_Visit (se_daily_plan_agent.py's _build_candidate_row) packs multiple clauses
// into one run-on string: "Matched X, Y, Z -- Cohort cohort, rank N -- Grade note 1; Grade
// note 2". The delimiters used ("--" between top-level clauses, "; " between per-objective
// grade notes) are also legal *inside* a grade note's own parenthetical explanation (e.g.
// "PL Grade D (...; AOP-allocated leg blended in (...))"), so a naive split() fragments
// those explanations too. This walks the string tracking paren depth and only splits at
// depth 0, so nested semicolons/dashes stay attached to their own bullet.
function splitTopLevel(text: string, delimiter: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth <= 0 && text.startsWith(delimiter, i)) {
      parts.push(current.trim());
      current = "";
      i += delimiter.length;
      continue;
    }
    current += ch;
    i++;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseReasonBullets(reason: string): string[] {
  if (!reason) return [];
  return splitTopLevel(reason, " -- ").flatMap((segment) => splitTopLevel(segment, "; "));
}

// A task's Objective is only ever empty here after resync_daily_tasks_from_selected_plan
// (planning/routing.py) rebuilt it from a RoutePlan stop instead of the full generation
// pipeline - a real candidate row always has a non-empty Objective (there's no way to
// reach _build_candidate_row without at least one matched objective). Reason_Of_Visit is
// the same tell independently, so check both for a safety margin against future changes.
function isResyncedTask(task: Task): boolean {
  return !task.Objective && !task.Reason_Of_Visit;
}

// The planned-vs-actual reconciliation block (OutcomePanel concern, §7): only
// meaningful once Reconciled_At is set, so it's a distinct "Actuals" section
// rather than columns that are blank for every future/unreconciled task.
function TaskDetailRow({ task, hasReconciliation }: { task: Task; hasReconciliation: boolean }) {
  const resynced = isResyncedTask(task);

  return (
    <div className="grid gap-4 py-2 sm:grid-cols-2 lg:grid-cols-4">
      {resynced && (
        <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          This task's detail was reset when a route plan was selected for this SE - the
          purpose above ({task.Purpose_Of_Visit}) is still accurate (it's carried over
          from generation), but the supporting numbers below were cleared and won't come
          back until you hit Create/Refresh to regenerate the plan.
        </div>
      )}
      <div className="sm:col-span-2 lg:col-span-4">
        <div className="text-xs text-muted-foreground">Reason of visit</div>
        {task.Reason_Of_Visit ? (
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
            {parseReasonBullets(task.Reason_Of_Visit).map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        ) : (
          <div className="text-sm">-</div>
        )}
      </div>
      {task.Critical && (
        <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="font-semibold uppercase tracking-wide">Critical - cover this first:</span>{" "}
          {task.Critical_Reasons}
        </div>
      )}
      <Field label="Days since last visit" value={task.Days_Since_Last_Visit} />
      <Field label="Present outstanding" value={formatCurrency(task.Present_Outstanding)} />
      <Field label="Present overdue" value={formatCurrency(task.Present_Overdue)} />
      <Field
        label="Avg repayment days"
        value={task.Avg_Repayment_Days != null ? `${Math.round(task.Avg_Repayment_Days)} days` : undefined}
      />
      <Field label="Last order date" value={task.Last_Order_Date} />
      <Field label="Last order value" value={formatCurrency(task.Last_Order_Value)} />
      <Field label="Last payment" value={task.Last_Payment_Date} />
      <Field label="YTD private label" value={formatCurrency(task.YTD_Private_Label)} />
      <Field label="DC club" value={task.DC_Club_Participation || undefined} />
      <Field
        label="Credit on hold"
        value={task.Credit_On_Hold ? `Yes - ${task.Credit_On_Hold_Reason ?? "no reason given"}` : "No"}
      />
      <ClubStandingDetail club={task.Club_Detail} />

      <div className={cn("sm:col-span-2 lg:col-span-4 rounded-md border p-3", !hasReconciliation && "opacity-60")}>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Actuals {!hasReconciliation && "(not yet reconciled)"}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Outcome status" value={task.Outcome_Status} />
          <Field label="Actual visit date" value={task.Actual_Visit_Date} />
          <Field label="Actual order value" value={formatCurrency(task.Actual_Order_Value)} />
          <Field label="Actual payment amount" value={formatCurrency(task.Actual_Payment_Amount)} />
        </div>
      </div>
    </div>
  );
}
