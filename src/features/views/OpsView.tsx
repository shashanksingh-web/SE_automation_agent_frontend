import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { TruncationNotice } from "@/shared/components/TruncationNotice";
import { useStreaks, useCompletionStats, useScheduledScopes } from "@/shared/api/hooks/useFeedbackOps";

// §13 - admin-only Feedback/Ops view: chronic-miss streaks, BO1/BO3 completion
// scoring, and which scopes auto-run on cron.
export function OpsView() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Ops / Feedback</h1>
      <Tabs defaultValue="streaks">
        <TabsList>
          <TabsTrigger value="streaks">Chronic misses</TabsTrigger>
          <TabsTrigger value="completion">BO scoring</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled scopes</TabsTrigger>
        </TabsList>
        <TabsContent value="streaks">
          <StreaksPanel />
        </TabsContent>
        <TabsContent value="completion">
          <CompletionStatsPanel />
        </TabsContent>
        <TabsContent value="scheduled">
          <ScheduledScopesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StreaksPanel() {
  const [minMisses, setMinMisses] = useState(3);
  const { data: page, isLoading } = useStreaks({ min_misses: minMisses });
  const rows = page?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span>Min consecutive misses</span>
        <Input
          type="number"
          className="h-8 w-20"
          value={minMisses}
          onChange={(e) => setMinMisses(Number(e.target.value) || 0)}
        />
      </div>
      <TruncationNotice page={page} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SE ID</TableHead>
            <TableHead>DC ID</TableHead>
            <TableHead>Consecutive misses</TableHead>
            <TableHead>Last outcome</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={`${s.SE_ID}-${s.DC_ID}`}>
              <TableCell>{s.SE_ID}</TableCell>
              <TableCell>{s.DC_ID}</TableCell>
              <TableCell>
                <Badge variant="destructive">{s.Consecutive_Misses}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{s.Last_Outcome_Date ?? "-"}</TableCell>
            </TableRow>
          ))}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                No chronic misses at this threshold.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}


// §13 - the real BO score source: no such field lives in PlanRun/task/route payloads,
// it's computed here via trailing-30d completion rate per objective. Objective values
// are real objective names/combos ("PL", "Visits", "Outstanding", "Long-Term", or
// comma-joined bundles like "PL,Visits") - not "BO1"/"BO3" labels.
function CompletionStatsPanel() {
  const [se, setSe] = useState("");
  const [objective, setObjective] = useState("");
  const { data: page, isLoading } = useCompletionStats({ se: se || undefined, objective: objective || undefined });
  const rows = page?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="SE ID (optional)" className="h-8 w-56" value={se} onChange={(e) => setSe(e.target.value)} />
        <Input
          placeholder="Objective (e.g. PL, Visits, Outstanding)"
          className="h-8 w-56"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
      </div>
      <TruncationNotice page={page} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SE ID</TableHead>
            <TableHead>Objective</TableHead>
            <TableHead>Trailing-30d rate</TableHead>
            <TableHead>Sample size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={`${c.SE_ID}-${c.Objective}`}>
              <TableCell>{c.SE_ID}</TableCell>
              <TableCell>{c.Objective}</TableCell>
              <TableCell>{(c.Completion_Rate_30d * 100).toFixed(1)}%</TableCell>
              <TableCell>{c.Sample_Size}</TableCell>
            </TableRow>
          ))}
          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                No completion stats for this filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ScheduledScopesPanel() {
  const { data, isLoading } = useScheduledScopes();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Scope</TableHead>
          <TableHead>Active</TableHead>
          <TableHead>Last run</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(data ?? []).map((s) => (
          <TableRow key={`${s.Scope_Type}-${s.Scope_Value}`}>
            <TableCell>
              {s.Scope_Type}: {s.Scope_Value}
            </TableCell>
            <TableCell>
              <Badge variant={s.Active ? "secondary" : "outline"}>{s.Active ? "Active" : "Inactive"}</Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{s.Last_Run_At ?? "-"}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{s.Created_At}</TableCell>
          </TableRow>
        ))}
        {!isLoading && (data ?? []).length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
              No scheduled scopes.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
