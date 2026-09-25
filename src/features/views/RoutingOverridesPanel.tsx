import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useRoutingOverrides,
  useUpsertRoutingOverride,
  useDeleteRoutingOverride,
} from "@/shared/api/hooks/useRoutingOverrides";
import { useNodes, useAllDistricts, useStates } from "@/shared/api/hooks/useDirectory";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/shared/components/ui/table";
import { MultiSelectPopover, type MultiSelectOption } from "@/shared/components/MultiSelectPopover";
import { ROUTING_OVERRIDE_FIELDS } from "@/shared/types/routingOverrides";
import type { RoutingOverrideScopeType } from "@/shared/types/routingOverrides";

type FieldKey = (typeof ROUTING_OVERRIDE_FIELDS)[number]["key"];

const EMPTY_VALUES: Record<FieldKey, string> = {
  r1_2_max_travel_minutes: "",
  plan_a_max_round_trip_distance_km: "",
  plan_b_max_daily_distance_km: "",
  plan_b_max_daily_travel_minutes: "",
};

// Per-scope Routing ceiling overrides (added 2026-09-11, explicit user request - "in
// routing parameter rule may be different for node, district, state or overall";
// DISTRICT + the enum-based multiselect below added same day, "district level override
// bhi add karo and value should be enam based list multiselect option"). Layered on top
// of the generic Routing group above (planning/admin_config.py's own network-wide
// values) - a NODE override wins over a DISTRICT override wins over a STATE override
// wins over whatever this Routing group currently shows, per field independently.
export function RoutingOverridesPanel() {
  const { user } = useAuth();
  const actor = user?.email ?? user?.name;
  const { data, isLoading, isError } = useRoutingOverrides();
  const upsert = useUpsertRoutingOverride();
  const del = useDeleteRoutingOverride();

  const [scopeType, setScopeType] = useState<RoutingOverrideScopeType>("NODE");
  const [scopeValues, setScopeValues] = useState<string[]>([]);
  const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY_VALUES);

  // Value is an enum-based multiselect, not free text - sourced from the same directory
  // endpoints the rest of the app already drives its dropdowns from (§6), so an admin
  // can only ever pick a Node/District/State that actually exists in the network.
  const { data: nodes, isLoading: nodesLoading } = useNodes();
  const { data: districts, isLoading: districtsLoading } = useAllDistricts();
  const { data: states, isLoading: statesLoading } = useStates();

  const valueOptions = useMemo<MultiSelectOption[]>(() => {
    if (scopeType === "NODE") {
      return (nodes ?? []).map((n) => ({ value: n.node, label: n.node, sublabel: n.state }));
    }
    if (scopeType === "DISTRICT") {
      // RoutingScopeOverride.scope_value for DISTRICT is a plain district name with no
      // state qualifier (matching se_daily_plan_agent.resolve_routing_ceilings's lookup
      // by district name alone) - a handful of district names exist in more than one
      // state (e.g. Aurangabad in both Bihar and Maharashtra), so this groups those into
      // one option with every state it appears in, rather than one row per (district,
      // state) pair with a duplicate value - besides being the honest UI (one override
      // here really does apply to every same-named district), duplicate `value`s given
      // to MultiSelectPopover as React keys made it drop rows once search narrowed the
      // list, since two list entries would otherwise share the same key.
      const byDistrict = new Map<string, Set<string>>();
      for (const d of districts ?? []) {
        if (!byDistrict.has(d.district)) byDistrict.set(d.district, new Set());
        byDistrict.get(d.district)!.add(d.state);
      }
      return Array.from(byDistrict.entries()).map(([district, states]) => ({
        value: district,
        label: district,
        sublabel: Array.from(states).sort().join(", "),
      }));
    }
    return (states ?? []).map((s) => ({ value: s.state, label: s.state }));
  }, [scopeType, nodes, districts, states]);
  const valueOptionsLoading =
    scopeType === "NODE" ? nodesLoading : scopeType === "DISTRICT" ? districtsLoading : statesLoading;

  const anyValueEntered = Object.values(values).some((v) => v !== "");

  const handleScopeTypeChange = (v: RoutingOverrideScopeType) => {
    setScopeType(v);
    setScopeValues([]);
  };

  // Multiple values can be selected at once - applies the same field values to each,
  // one upsert call per value (kept simple client-side rather than adding a bulk-upsert
  // endpoint, since this list is expected to stay small - a handful of nodes/districts/
  // states an admin actually tunes at a time, not a bulk-import workflow).
  const handleAdd = () => {
    if (scopeValues.length === 0 || !anyValueEntered) return;
    const fields: Partial<Record<FieldKey, number | null>> = {};
    for (const { key } of ROUTING_OVERRIDE_FIELDS) {
      if (values[key] !== "") fields[key] = Number(values[key]);
    }
    Promise.all(
      scopeValues.map((scopeValue) => upsert.mutateAsync({ scopeType, scopeValue, fields, actor })),
    ).then(() => {
      setScopeValues([]);
      setValues(EMPTY_VALUES);
    });
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
          Most specific wins: a Node override beats a District override beats a State override beats the
          network-wide values above - independently per field. Leave a field blank to fall through to a
          less-specific scope. Selecting multiple values applies the same fields to each.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="space-y-1">
            <Label className="text-xs">Scope</Label>
            <Select value={scopeType} onValueChange={(v) => handleScopeTypeChange(v as RoutingOverrideScopeType)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NODE">Node</SelectItem>
                <SelectItem value="DISTRICT">District</SelectItem>
                <SelectItem value="STATE">State</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <MultiSelectPopover
              className="w-56"
              options={valueOptions}
              selected={scopeValues}
              onChange={setScopeValues}
              loading={valueOptionsLoading}
              placeholder={`Select ${scopeType.toLowerCase()}(s)...`}
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
          <Button size="sm" onClick={handleAdd} disabled={scopeValues.length === 0 || !anyValueEntered || upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add / update{scopeValues.length > 1 ? ` (${scopeValues.length})` : ""}
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
