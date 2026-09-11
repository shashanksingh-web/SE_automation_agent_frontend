import { useMemo, useState } from "react";
import { RotateCcw, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { useAdminConfig, useUpdateAdminConfig } from "@/shared/api/hooks/useAdminConfig";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import type { AdminConfigField } from "@/shared/types/adminConfig";
import { DCSelectionPanel } from "@/features/views/DCSelectionPanel";
import { RoutingOverridesPanel } from "@/features/views/RoutingOverridesPanel";

// "DC Selection" is also planning/admin_config.py's own group name for two unrelated
// numeric thresholds (GR-28/90+-day-boost overdue minimums) - renamed here for the tab
// label only (not the underlying group key used for lookups/edits) so it doesn't read
// as the same thing as the Program DC List tab below.
const PROGRAM_DC_LIST_TAB = "program-dc-list";
const tabLabel = (group: string) => (group === "DC Selection" ? "DC Selection Thresholds" : group);

// Admin Control Panel (added 2026-09-07, explicit user request - "add the new tab for
// admin control panel", built off the SE_Daily_Task_Agent_Pipeline_Walkthrough sheet's
// Steps 1-12). Live-editable overrides onto se_daily_plan_agent.BusinessConstants -
// GET/POST /api/planning/admin/config/ (planning/admin_config.py has the authoritative
// field list/metadata; this component renders whatever it returns generically rather
// than hardcoding field names here, so a backend-side whitelist change never needs a
// matching frontend deploy).
//
// Edits are staged locally (pendingEdits) and applied in one batch via "Save changes" -
// typing shouldn't fire a network request per keystroke. "Reset to default" per field is
// immediate instead (removing an override is inherently safe, always reversible by
// typing the value back in), so it doesn't need the same staging step.
export function AdminView() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useAdminConfig();
  const updateConfig = useUpdateAdminConfig();
  const [pendingEdits, setPendingEdits] = useState<Record<string, number>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const pendingCount = Object.keys(pendingEdits).length;

  const setEdit = (field: AdminConfigField, raw: string) => {
    const parsed = field.type === "int" ? parseInt(raw, 10) : parseFloat(raw);
    setPendingEdits((prev) => {
      const next = { ...prev };
      if (raw === "" || Number.isNaN(parsed) || parsed === field.value) {
        delete next[field.key];
      } else {
        next[field.key] = parsed;
      }
      return next;
    });
  };

  const handleSave = () => {
    if (pendingCount === 0) return;
    updateConfig.mutate(
      { changes: pendingEdits, actor: user?.email ?? user?.name },
      {
        onSuccess: (result) => {
          setSaveErrors(result.Errors ?? {});
          // Only clear edits that actually succeeded (weren't reported as an error) -
          // a rejected value stays in the input, still visibly "pending", so the admin
          // can see and fix exactly what failed instead of it silently reverting.
          setPendingEdits((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(prev)) {
              if (!result.Errors?.[key]) delete next[key];
            }
            return next;
          });
        },
      },
    );
  };

  const handleDiscard = () => {
    setPendingEdits({});
    setSaveErrors({});
  };

  const handleReset = (key: string) => {
    updateConfig.mutate(
      { changes: {}, reset: [key], actor: user?.email ?? user?.name },
      {
        onSuccess: () => {
          setPendingEdits((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          setSaveErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        },
      },
    );
  };

  // Health Score's 7 weights are documented (per-field description) as "should sum to
  // 1.0" - a soft, non-blocking warning computed here from whatever's currently shown
  // (pending edit if any, else the live value), not a hard validation rule the backend
  // enforces (see admin_config.apply_overrides - min/max only, no cross-field checks).
  const healthWeightSum = useMemo(() => {
    if (!data) return null;
    const group = data.Groups.find((g) => g.Group === "Health Score");
    if (!group) return null;
    const weightFields = group.Fields.filter((f) => f.key.startsWith("health_weight_"));
    if (weightFields.length === 0) return null;
    return weightFields.reduce((sum, f) => sum + (pendingEdits[f.key] ?? f.value), 0);
  }, [data, pendingEdits]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline config...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-4 text-sm text-destructive">
        Could not load the Admin Control Panel config.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Admin Control Panel</h1>
          <p className="text-sm text-muted-foreground">
            Live overrides onto the SE Daily Task Agent pipeline's hardcoded defaults - changes here affect the{" "}
            <em>next</em> plan generation onward, not any already-generated PlanRun.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pendingCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={updateConfig.isPending}>
              Discard
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={pendingCount === 0 || updateConfig.isPending}>
            {updateConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"}` : "changes"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue={PROGRAM_DC_LIST_TAB}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value={PROGRAM_DC_LIST_TAB}>Program DC List</TabsTrigger>
          {data.Groups.map((group) => (
            <TabsTrigger key={group.Group} value={group.Group}>
              {tabLabel(group.Group)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* forceMount on every tab keeps them all mounted (just hidden) rather than
            unmounting on switch - DCSelectionPanel stages its own rule edits locally
            (pendingRules etc.), which would silently be lost on remount if an admin
            switched tabs mid-edit without saving or discarding first. */}
        <TabsContent value={PROGRAM_DC_LIST_TAB} forceMount className="mt-4 data-[state=inactive]:hidden">
          <DCSelectionPanel />
        </TabsContent>

        {data.Groups.map((group) => (
          <TabsContent key={group.Group} value={group.Group} forceMount className="mt-4 data-[state=inactive]:hidden">
            <Card>
              <CardHeader>
                <CardTitle>{group.Group}</CardTitle>
                {group.Group === "Health Score" && healthWeightSum != null && (
                  <CardDescription>
                    7 weights should sum to 1.0 - currently{" "}
                    <span className={Math.abs(healthWeightSum - 1) > 0.001 ? "font-medium text-destructive" : "font-medium text-primary"}>
                      {healthWeightSum.toFixed(2)}
                    </span>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.Fields.map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    pendingValue={pendingEdits[field.key]}
                    error={saveErrors[field.key]}
                    onChange={(raw) => setEdit(field, raw)}
                    onReset={() => handleReset(field.key)}
                    busy={updateConfig.isPending}
                  />
                ))}
              </CardContent>
            </Card>
            {group.Group === "Routing" && (
              <div className="mt-4">
                <RoutingOverridesPanel />
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {data.Updated_At && (
        <div className="text-xs text-muted-foreground">
          Last changed {new Date(data.Updated_At).toLocaleString()}
          {data.Updated_By && ` by ${data.Updated_By}`}
        </div>
      )}
    </div>
  );
}

function FieldEditor({
  field,
  pendingValue,
  error,
  onChange,
  onReset,
  busy,
}: {
  field: AdminConfigField;
  pendingValue: number | undefined;
  error: string | undefined;
  onChange: (raw: string) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const displayValue = pendingValue ?? field.value;
  const isDirty = pendingValue !== undefined;

  return (
    <div className="space-y-1">
      <Label htmlFor={field.key} className="flex items-center gap-1.5 text-xs" title={field.description}>
        {field.label}
        {field.overridden && !isDirty && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
            overridden
          </Badge>
        )}
        {isDirty && (
          <Badge variant="warning" className="h-4 px-1 text-[10px] font-normal">
            unsaved
          </Badge>
        )}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={field.key}
          type="number"
          step={field.type === "float" ? "any" : 1}
          min={field.min}
          max={field.max}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-destructive" : undefined}
        />
        {field.unit && <span className="shrink-0 text-xs text-muted-foreground">{field.unit}</span>}
        {(field.overridden || isDirty) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Reset to default"
            disabled={busy}
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground">
        default: {field.default}
        {field.description && ` - ${field.description}`}
      </div>
      {error && <div className="text-[11px] text-destructive">{error}</div>}
    </div>
  );
}
