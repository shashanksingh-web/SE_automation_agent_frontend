import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useRoutingOverrides,
  useUpsertRoutingOverride,
  useDeleteRoutingOverride,
} from "@/shared/api/hooks/useRoutingOverrides";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import { ROUTING_OVERRIDE_FIELDS } from "@/shared/types/routingOverrides";
import type { RoutingOverrideScopeType } from "@/shared/types/routingOverrides";

type FieldKey = (typeof ROUTING_OVERRIDE_FIELDS)[number]["key"];

// Per-scope Routing ceiling overrides (added 2026-09-11, explicit user request - "in
// routing parameter rule may be different for node, district, state or overall").
// Layered on top of the generic Routing group above (planning/admin_config.py's own
// network-wide values) - a NODE override wins over a STATE override wins over whatever
// this Routing group currently shows, per field independently. DISTRICT is deliberately
// not offered - see planning/models.py RoutingScopeOverride's own docstring for why
// (no District field reaches the per-SE routing call site yet).
export function RoutingOverridesPanel() {
  const { user } = useAuth();
  const actor = user?.email ?? user?.name;
  const { data, isLoading, isError } = useRoutingOverrides();
  const upsert = useUpsertRoutingOverride();
  const del = useDeleteRoutingOverride();

  const [scopeType, setScopeType] = useState<RoutingOverrideScopeType>("NODE");
  const [scopeValue, setScopeValue] = useState("");
  const [values, setValues] = useState<Record<FieldKey, string>>({
    r1_2_max_travel_minutes: "",
    plan_a_max_round_trip_distance_km: "",
    plan_b_max_daily_distance_km: "",
    plan_b_max_daily_travel_minutes: "",
  });

  const anyValueEntered = Object.values(values).some((v) => v !== "");

  const handleAdd = () => {
    if (!scopeValue.trim() || !anyValueEntered) return;
    const fields: Partial<Record<FieldKey, number | null>> = {};
    for (const { key } of ROUTING_OVERRIDE_FIELDS) {
      if (values[key] !== "") fields[key] = Number(values[key]);
    }
    upsert.mutate(
      { scopeType, scopeValue: scopeValue.trim(), fields, actor },
      {
        onSuccess: () => {
          setScopeValue("");
          setValues({
            r1_2_max_travel_minutes: "",
            plan_a_max_round_trip_distance_km: "",
            plan_b_max_daily_distance_km: "",
            plan_b_max_daily_travel_minutes: "",
          });
        },
      },
    );
  };

  const handleClearField = (scopeT: RoutingOverrideScopeType, scopeV: string, field: FieldKey) => {
    upsert.mutate({ scopeType: scopeT, scopeValue: scopeV, fields: { [field]: null }, actor });
  };

  const handleDeleteRow = (scopeT: RoutingOverrideScopeType, scopeV: string) => {
    del.mutate({ scopeType: scopeT, scopeValue: scopeV });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Per-scope overrides</CardTitle>
        <CardDescription>
          Most specific wins: a Node override beats a State override beats the network-wide values above -
          independently per field. Leave a field blank to fall through to a less-specific scope.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="space-y-1">
            <Label className="text-xs">Scope</Label>
            <Select value={scopeType} onValueChange={(v) => setScopeType(v as RoutingOverrideScopeType)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NODE">Node</SelectItem>
                <SelectItem value="STATE">State</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <Input
              className="w-40"
              placeholder={scopeType === "NODE" ? "e.g. Jaipur" : "e.g. Rajasthan"}
              value={scopeValue}
              onChange={(e) => setScopeValue(e.target.value)}
            />
          </div>
          {ROUTING_OVERRIDE_FIELDS.map(({ key, label, unit }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">
                {label} ({unit})
              </Label>
              <Input
                type="number"
                className="w-32"
                placeholder="unset"
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
          <Button size="sm" onClick={handleAdd} disabled={!scopeValue.trim() || !anyValueEntered || upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add / update
          </Button>
        </div>
        {upsert.isError && (
          <div className="text-xs text-destructive">
            {(upsert.error as { body?: { error?: string } })?.body?.error ?? "Could not save override"}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading overrides...
          </div>
        )}
        {isError && <div className="text-sm text-destructive">Could not load routing overrides.</div>}

        {data && data.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scope</TableHead>
                  {ROUTING_OVERRIDE_FIELDS.map(({ key, label, unit }) => (
                    <TableHead key={key}>
                      {label} ({unit})
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={`${row.Scope_Type}:${row.Scope_Value}`}>
                    <TableCell>
                      {row.Scope_Type}: {row.Scope_Value}
                    </TableCell>
                    {ROUTING_OVERRIDE_FIELDS.map(({ key }) => (
                      <TableCell key={key}>
                        {row[key] ?? <span className="text-muted-foreground">—</span>}
                        {row[key] != null && (
                          <button
                            type="button"
                            className="ml-1.5 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() => handleClearField(row.Scope_Type, row.Scope_Value, key)}
                            disabled={upsert.isPending}
                          >
                            clear
                          </button>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Delete this override entirely"
                        onClick={() => handleDeleteRow(row.Scope_Type, row.Scope_Value)}
                        disabled={del.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No per-scope overrides configured yet - every Node/State currently uses the network-wide values above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
