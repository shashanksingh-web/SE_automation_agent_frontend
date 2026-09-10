import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useRunsList, useRunDetail } from "@/shared/api/hooks/useRuns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/components/ui/drawer";
import { PlanRunDetail } from "@/features/views/shared/PlanRunDetail";
import { PitchPanel } from "@/features/pitching/PitchPanel";
import { DCCardPanel } from "@/features/dcCard/DCCardPanel";
import { PlanDrawer } from "@/features/routing/PlanDrawer";
import type { Task } from "@/shared/types/planRun";

// PlanRun.ScopeType choices (SE_automation_server/planning/models.py) - 7 values, no
// "ZBM" (that's directory-only, no PlanRun is ever generated at ZBM scope).
const SCOPE_TYPES = ["SE", "ABM", "RBM", "NODE", "BLOCK", "DISTRICT", "STATE"];
const STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED"];
const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "warning"> = {
  PENDING_REVIEW: "warning",
  APPROVED: "default",
  REJECTED: "destructive",
};

// System Plan Runs (added 2026-09-10, explicit user request - "add one more tab where
// all system plan created with all filter") - every PlanRun ever generated, network-wide,
// with the full filter set the backend supports (scope_type/scope_value/status/
// plan_date) rather than RunsHistoryPanel's single-status-chip drawer. Row click opens
// the same detail view RunsHistoryPanel already uses (PlanRunDetail + Pitch/DCCard/
// Route drawers) so there's one shared "look at a run" experience, not two.
export function AllPlanRunsPanel() {
  const [scopeType, setScopeType] = useState("");
  const [scopeValue, setScopeValue] = useState("");
  const [status, setStatus] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [pitchTask, setPitchTask] = useState<Task | null>(null);
  const [dcCardTask, setDCCardTask] = useState<Task | null>(null);
  const [routesTarget, setRoutesTarget] = useState<{ seId: string; dcNames: Record<string, string> } | null>(null);

  const listQuery = useRunsList({
    scope_type: scopeType || undefined,
    scope_value: scopeValue.trim() || undefined,
    status: status || undefined,
    plan_date: planDate || undefined,
    limit,
    offset,
  });
  const detailQuery = useRunDetail(selectedRunId ?? undefined);

  const clearFilters = () => {
    setScopeType("");
    setScopeValue("");
    setStatus("");
    setPlanDate("");
    setOffset(0);
  };

  const anyFilterActive = scopeType || scopeValue || status || planDate;
  const total = listQuery.data?.totalCount ?? 0;
  const rows = listQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>System Plan Runs</CardTitle>
          <CardDescription>
            Every PlanRun ever generated, network-wide - filter by scope, status, or plan date. Click a row for
            its full task list, pitches, DC cards, and route plans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Scope type</Label>
              <Select
                value={scopeType || "all"}
                onValueChange={(v) => {
                  setScopeType(v === "all" ? "" : v);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {SCOPE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scope value</Label>
              <Input
                className="w-48"
                placeholder="e.g. Jaipur, se@email.com"
                value={scopeValue}
                onChange={(e) => {
                  setScopeValue(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={status || "all"}
                onValueChange={(v) => {
                  setStatus(v === "all" ? "" : v);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Plan date</Label>
              <Input
                type="date"
                className="w-40"
                value={planDate}
                onChange={(e) => {
                  setPlanDate(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
            {anyFilterActive && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {listQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading runs...
            </div>
          )}
          {listQuery.isError && (
            <div className="text-sm text-destructive">Could not load plan runs.</div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Plan date</TableHead>
                  <TableHead>Generated at</TableHead>
                  <TableHead>SEs</TableHead>
                  <TableHead>DCs</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((run) => (
                  <TableRow
                    key={run.PlanRun_ID}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => setSelectedRunId(run.PlanRun_ID)}
                  >
                    <TableCell className="font-mono text-xs">{run.PlanRun_ID}</TableCell>
                    <TableCell>
                      {run.Scope_Type}: {run.Scope_Value}
                    </TableCell>
                    <TableCell>{run.Plan_Date}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(run.Run_Timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{run.SE_Count}</TableCell>
                    <TableCell>{run.DC_Count}</TableCell>
                    <TableCell>{run.Task_Count}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[run.Status] ?? "secondary"}>{run.Status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!listQuery.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      No plan runs match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {total > limit && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Drawer open={!!selectedRunId} onOpenChange={(o) => !o && setSelectedRunId(null)}>
        <DrawerContent className="max-w-2xl">
          <DrawerHeader>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedRunId(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <DrawerTitle>Run {selectedRunId}</DrawerTitle>
            </div>
          </DrawerHeader>
          <div className="overflow-auto">
            {detailQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading run...
              </div>
            )}
            {detailQuery.data && (
              <PlanRunDetail
                planRun={detailQuery.data}
                onOpenPitch={setPitchTask}
                onOpenDCCard={setDCCardTask}
                onOpenRoutes={(seId, dcNames) => setRoutesTarget({ seId, dcNames })}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <PitchPanel
        dailyTaskId={pitchTask?.DailyTask_ID ?? null}
        dcName={pitchTask?.DC_Name}
        onClose={() => setPitchTask(null)}
      />
      <DCCardPanel
        dailyTaskId={dcCardTask?.DailyTask_ID ?? null}
        dcName={dcCardTask?.DC_Name}
        onClose={() => setDCCardTask(null)}
      />
      <PlanDrawer
        se={routesTarget?.seId ?? null}
        planDate={detailQuery.data?.meta.Plan_Date ?? ""}
        dcNames={routesTarget?.dcNames}
        exceptions={detailQuery.data?.exceptions}
        onClose={() => setRoutesTarget(null)}
      />
    </div>
  );
}
