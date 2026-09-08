import { useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Save, Search as SearchIcon, Upload } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { dcSelectionApi } from "@/shared/api/endpoints";
import {
  useDCSelection,
  useDCSelectionSearch,
  useUpdateDCSelection,
  useUploadDCSelectionRankCsv,
  useUploadDCSelectionSelectedDcs,
} from "@/shared/api/hooks/useDCSelection";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import type { DCSelectionCombine, DCSelectionFilterMode, DCSelectionRules } from "@/shared/types/dcSelection";

const COHORT_OPTIONS = ["Strategic", "Growth", "Opportunity", "Long Tail"];

// DC Selection (added 2026-09-08, explicit user request - "in admin control panel we
// have select the dcs for this whole program"). Replaces the Excel 'updated TOP DC
// list.xlsx' as the DC eligibility gate's master source with an admin-configurable
// AND/OR rule over dc_datamart + an uploadable DC_RAnk.csv, plus manual include/exclude
// (search & toggle, or bulk paste) on top - see planning/dc_selection.py's module
// docstring for the full design and se_daily_plan_agent.evaluate_dc_selection_rule for
// the AND/OR engine this panel configures.
export function DCSelectionPanel() {
  const { user } = useAuth();
  const actor = user?.email ?? user?.name;
  const { data, isLoading, isError } = useDCSelection();
  const updateSelection = useUpdateDCSelection();
  const uploadRankCsv = useUploadDCSelectionRankCsv();
  const uploadSelectedDcs = useUploadDCSelectionSelectedDcs();

  const [pendingRules, setPendingRules] = useState<DCSelectionRules | null>(null);
  const rules = pendingRules ?? data?.Rules ?? null;
  const rulesDirty = pendingRules !== null;

  const [bulkIncludeText, setBulkIncludeText] = useState("");
  const [bulkExcludeText, setBulkExcludeText] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<DCSelectionFilterMode>("all");
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const search = useDCSelectionSearch(searchQuery, filterMode, offset, limit);

  const setRule = <K extends keyof DCSelectionRules>(key: K, patch: Partial<DCSelectionRules[K]>) => {
    if (!rules) return;
    setPendingRules({ ...rules, [key]: { ...rules[key], ...patch } });
  };

  const handleSaveRules = () => {
    if (!rules) return;
    updateSelection.mutate(
      { rules, actor },
      { onSuccess: () => setPendingRules(null) },
    );
  };

  const handleDiscardRules = () => setPendingRules(null);

  const handleUpload = (file: File) => {
    uploadRankCsv.mutate({ file, actor });
  };

  const handleUploadSelectedDcs = (file: File) => {
    uploadSelectedDcs.mutate({ file, actor });
  };

  const toggleManual = (dcId: string, list: "include" | "exclude", add: boolean) => {
    if (!data) return;
    const includes = new Set(data.Manual_Includes);
    const excludes = new Set(data.Manual_Excludes);
    if (list === "include") {
      add ? includes.add(dcId) : includes.delete(dcId);
      if (add) excludes.delete(dcId);
    } else {
      add ? excludes.add(dcId) : excludes.delete(dcId);
      if (add) includes.delete(dcId);
    }
    updateSelection.mutate({
      manual_includes: Array.from(includes),
      manual_excludes: Array.from(excludes),
      actor,
    });
  };

  const applyBulkPaste = (mode: "include" | "exclude") => {
    if (!data) return;
    const raw = mode === "include" ? bulkIncludeText : bulkExcludeText;
    const ids = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;
    const includes = new Set(data.Manual_Includes);
    const excludes = new Set(data.Manual_Excludes);
    for (const id of ids) {
      if (mode === "include") {
        includes.add(id);
        excludes.delete(id);
      } else {
        excludes.add(id);
        includes.delete(id);
      }
    }
    updateSelection.mutate(
      { manual_includes: Array.from(includes), manual_excludes: Array.from(excludes), actor },
      {
        onSuccess: () => {
          mode === "include" ? setBulkIncludeText("") : setBulkExcludeText("");
        },
      },
    );
  };

  const cohortValues = useMemo(() => new Set(rules?.cohort.values ?? []), [rules]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading DC Selection...
      </div>
    );
  }

  if (isError || !data || !rules) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-4 text-sm text-destructive">
        Could not load DC Selection.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>DC Selection</CardTitle>
              <CardDescription>
                Replaces the Excel Top DC list as the DC eligibility gate's master source -
                dc_datamart + DC_RAnk.csv, filtered by the rule below, once it's configured.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {rulesDirty && (
                <Button variant="outline" size="sm" onClick={handleDiscardRules} disabled={updateSelection.isPending}>
                  Discard
                </Button>
              )}
              <Button size="sm" onClick={handleSaveRules} disabled={!rulesDirty || updateSelection.isPending}>
                {updateSelection.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save rule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={data.Configured ? "default" : "secondary"}>
              {data.Configured ? "Active" : "Not configured (Excel Top DC list still in effect)"}
            </Badge>
            <span className="text-muted-foreground">
              {data.Selected_Count ?? "—"} / {data.Universe_Size} DCs selected
            </span>
            {!data.Live_Query_Ok && (
              <Badge variant="warning">dc_datamart query failed - Active/Overdue criteria can't match right now</Badge>
            )}
          </div>

          <CriterionRow
            label="Rank range"
            enabled={rules.rank_range.enabled}
            combine={rules.rank_range.combine}
            onEnabledChange={(enabled) => setRule("rank_range", { enabled })}
            onCombineChange={(combine) => setRule("rank_range", { combine })}
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                className="w-24"
                value={rules.rank_range.min ?? ""}
                onChange={(e) => setRule("rank_range", { min: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                placeholder="Max"
                className="w-24"
                value={rules.rank_range.max ?? ""}
                onChange={(e) => setRule("rank_range", { max: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
          </CriterionRow>

          <CriterionRow
            label="Cohort"
            enabled={rules.cohort.enabled}
            combine={rules.cohort.combine}
            onEnabledChange={(enabled) => setRule("cohort", { enabled })}
            onCombineChange={(combine) => setRule("cohort", { combine })}
          >
            <div className="flex flex-wrap gap-3">
              {COHORT_OPTIONS.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={cohortValues.has(c)}
                    onCheckedChange={(checked) => {
                      const next = new Set(cohortValues);
                      checked ? next.add(c) : next.delete(c);
                      setRule("cohort", { values: Array.from(next) });
                    }}
                  />
                  {c}
                </label>
              ))}
            </div>
          </CriterionRow>

          <CriterionRow
            label="Active status"
            enabled={rules.active_status.enabled}
            combine={rules.active_status.combine}
            onEnabledChange={(enabled) => setRule("active_status", { enabled })}
            onCombineChange={(combine) => setRule("active_status", { combine })}
          >
            <Select
              value={rules.active_status.value}
              onValueChange={(v) => setRule("active_status", { value: v as "active" | "inactive" })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </CriterionRow>

          <CriterionRow
            label="Overdue"
            enabled={rules.overdue.enabled}
            combine={rules.overdue.combine}
            onEnabledChange={(enabled) => setRule("overdue", { enabled })}
            onCombineChange={(combine) => setRule("overdue", { combine })}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Overdue &gt;</span>
              <Input
                type="number"
                className="w-28"
                value={rules.overdue.min_amount}
                onChange={(e) => setRule("overdue", { min_amount: Number(e.target.value) || 0 })}
              />
            </div>
          </CriterionRow>

          <p className="text-[11px] text-muted-foreground">
            AND narrows the selection (a DC must also match); OR adds DCs matching that criterion on top of
            whatever the AND criteria selected, regardless of rank/cohort/status.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rank &amp; Cohort uploader</CardTitle>
          <CardDescription>
            Replaces DC_RAnk.csv (Partner Id/Rank/Cohort columns required) - also feeds the pipeline's own
            Cohort/Total_Score ordering, not just this filter.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <label>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" asChild disabled={uploadRankCsv.isPending}>
              <span>
                {uploadRankCsv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload CSV
              </span>
            </Button>
          </label>
          <SampleFormatLink href={dcSelectionApi.sampleRankCsvUrl()} />
          <span className="text-xs text-muted-foreground">
            {data.Rank_Csv_Uploaded_At
              ? `Last uploaded ${new Date(data.Rank_Csv_Uploaded_At).toLocaleString()}${
                  data.Rank_Csv_Uploaded_By ? ` by ${data.Rank_Csv_Uploaded_By}` : ""
                } (${data.Rank_Csv_Row_Count} rows)`
              : "Never manually uploaded - using the file already on disk."}
          </span>
          {uploadRankCsv.isError && (
            <span className="text-xs text-destructive">
              {(uploadRankCsv.error as { body?: { error?: string } })?.body?.error ?? "Upload failed"}
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selected DC List uploader</CardTitle>
          <CardDescription>
            Upload a file of DC IDs (one per row, header optional) to select in one go - each ID is looked up
            against DC_RAnk.csv for its Rank/Cohort, then added to Manual Includes (unioned into the final
            selection on top of the rule above, same as the Bulk Paste tab below).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label>
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadSelectedDcs(file);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" size="sm" asChild disabled={uploadSelectedDcs.isPending}>
                <span>
                  {uploadSelectedDcs.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload DC list
                </span>
              </Button>
            </label>
            <SampleFormatLink href={dcSelectionApi.sampleSelectedDcsCsvUrl()} />
            {uploadSelectedDcs.isSuccess && (
              <span className="text-xs text-muted-foreground">
                Added {uploadSelectedDcs.data.Uploaded_Dc_Count ?? "?"} DC ID(s) to Manual Includes.
              </span>
            )}
            {uploadSelectedDcs.isError && (
              <span className="text-xs text-destructive">
                {(uploadSelectedDcs.error as { body?: { error?: string } })?.body?.error ?? "Upload failed"}
              </span>
            )}
          </div>

          {uploadSelectedDcs.isSuccess && (uploadSelectedDcs.data.Uploaded_Not_Found_Count ?? 0) > 0 && (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {uploadSelectedDcs.data.Uploaded_Not_Found_Count} of {uploadSelectedDcs.data.Uploaded_Dc_Count} uploaded DC ID(s)
                not found in DC_RAnk.csv
              </div>
              <ul className="space-y-1.5 text-xs">
                {uploadSelectedDcs.data.Uploaded_Dcs?.filter((dc) => !dc.found).map((dc) => (
                  <li key={dc.dc_id}>
                    <span className="font-mono font-medium text-destructive">{dc.dc_id}</span>
                    <span className="text-muted-foreground"> — {dc.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {uploadSelectedDcs.isSuccess && (uploadSelectedDcs.data.Uploaded_Dcs?.length ?? 0) > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DC ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Found in DC_RAnk.csv</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadSelectedDcs.data.Uploaded_Dcs?.map((dc) => (
                    <TableRow key={dc.dc_id}>
                      <TableCell className="font-mono text-xs">{dc.dc_id}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={dc.dc_name ?? undefined}>
                        {dc.dc_name ?? "—"}
                      </TableCell>
                      <TableCell>{typeof dc.rank === "number" ? dc.rank : (dc.rank ?? "—")}</TableCell>
                      <TableCell>{dc.cohort ?? "—"}</TableCell>
                      <TableCell>
                        {dc.found ? (
                          <Badge variant="default">yes</Badge>
                        ) : (
                          <Badge variant="warning">not found - selected anyway</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual overrides</CardTitle>
          <CardDescription>Search &amp; toggle individual DCs, or bulk-paste DC IDs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="search">
            <TabsList>
              <TabsTrigger value="search">Search &amp; toggle</TabsTrigger>
              <TabsTrigger value="paste">Bulk paste</TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-3 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="w-56 pl-7"
                    placeholder="Search DC ID or name"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setOffset(0);
                    }}
                  />
                </div>
                <Select
                  value={filterMode}
                  onValueChange={(v) => {
                    setFilterMode(v as DCSelectionFilterMode);
                    setOffset(0);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All DCs</SelectItem>
                    <SelectItem value="selected">In selection</SelectItem>
                    <SelectItem value="excluded">Not selected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DC ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Rank</TableHead>
                      <TableHead>Cohort</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Overdue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {search.data?.dcs.map((dc) => (
                      <TableRow key={dc.dc_id}>
                        <TableCell className="font-mono text-xs">{dc.dc_id}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={dc.dc_name ?? undefined}>
                          {dc.dc_name ?? "—"}
                        </TableCell>
                        <TableCell>{typeof dc.rank === "number" ? dc.rank : (dc.rank ?? "—")}</TableCell>
                        <TableCell>{dc.cohort ?? "—"}</TableCell>
                        <TableCell>{dc.is_active === null ? "—" : dc.is_active ? "Yes" : "No"}</TableCell>
                        <TableCell>{dc.overdue ?? "—"}</TableCell>
                        <TableCell>
                          {dc.manually_included && <Badge variant="default">manually included</Badge>}
                          {dc.manually_excluded && <Badge variant="destructive">manually excluded</Badge>}
                          {!dc.manually_included && !dc.manually_excluded && (
                            <Badge variant={dc.in_selection ? "default" : "secondary"}>
                              {dc.in_selection ? "selected" : "not selected"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant={dc.manually_included ? "default" : "outline"}
                              size="sm"
                              disabled={updateSelection.isPending}
                              onClick={() => toggleManual(dc.dc_id, "include", !dc.manually_included)}
                            >
                              Include
                            </Button>
                            <Button
                              variant={dc.manually_excluded ? "destructive" : "outline"}
                              size="sm"
                              disabled={updateSelection.isPending}
                              onClick={() => toggleManual(dc.dc_id, "exclude", !dc.manually_excluded)}
                            >
                              Exclude
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {search.data?.dcs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                          No DCs match.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {search.data && search.data.total > limit && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {offset + 1}-{Math.min(offset + limit, search.data.total)} of {search.data.total}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + limit >= search.data.total}
                      onClick={() => setOffset(offset + limit)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="paste" className="space-y-4 pt-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Include these DC IDs (always selected)</Label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="One per line, or comma-separated"
                    value={bulkIncludeText}
                    onChange={(e) => setBulkIncludeText(e.target.value)}
                  />
                  <Button size="sm" onClick={() => applyBulkPaste("include")} disabled={updateSelection.isPending || !bulkIncludeText.trim()}>
                    Apply includes
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Exclude these DC IDs (always removed)</Label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="One per line, or comma-separated"
                    value={bulkExcludeText}
                    onChange={(e) => setBulkExcludeText(e.target.value)}
                  />
                  <Button size="sm" onClick={() => applyBulkPaste("exclude")} disabled={updateSelection.isPending || !bulkExcludeText.trim()}>
                    Apply excludes
                  </Button>
                </div>
              </div>
              {(data.Manual_Includes.length > 0 || data.Manual_Excludes.length > 0) && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {data.Manual_Includes.length > 0 && <div>Currently manually included: {data.Manual_Includes.join(", ")}</div>}
                  {data.Manual_Excludes.length > 0 && <div>Currently manually excluded: {data.Manual_Excludes.join(", ")}</div>}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function CriterionRow({
  label,
  enabled,
  combine,
  onEnabledChange,
  onCombineChange,
  children,
}: {
  label: string;
  enabled: boolean;
  combine: DCSelectionCombine;
  onEnabledChange: (enabled: boolean) => void;
  onCombineChange: (combine: DCSelectionCombine) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <label className="flex w-40 shrink-0 items-center gap-2 text-sm font-medium">
        <Checkbox checked={enabled} onCheckedChange={(checked) => onEnabledChange(Boolean(checked))} />
        {label}
      </label>
      <Select value={combine} onValueChange={(v) => onCombineChange(v as DCSelectionCombine)}>
        <SelectTrigger className="w-20" disabled={!enabled}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AND">AND</SelectItem>
          <SelectItem value="OR">OR</SelectItem>
        </SelectContent>
      </Select>
      <div className={enabled ? undefined : "pointer-events-none opacity-40"}>{children}</div>
    </div>
  );
}

// Plain <a href> to a backend endpoint that returns the file with Content-Disposition:
// attachment - a real browser GET/download, not a fetch call, so no onClick handler or
// blob URL is needed here.
function SampleFormatLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
    >
      <Download className="h-3 w-3" />
      Sample format
    </a>
  );
}
