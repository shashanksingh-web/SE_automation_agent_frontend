import { useEffect, useState, type ReactNode } from "react";
import { useAppStore } from "@/shared/store/appStore";
import { useAuth } from "@/features/auth/AuthContext";
import { isScopeValueLockedToSelf, ownScopeValue } from "@/features/rbac/rbac";
import {
  useStates,
  useDistricts,
  useBlocks,
  useNodes,
  useRbms,
  useAbms,
  useZbms,
  useSEs,
} from "@/shared/api/hooks/useDirectory";
import { MultiSelectPopover, type MultiSelectOption } from "@/shared/components/MultiSelectPopover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import type { ScopeType } from "@/shared/types/scope";

interface ScopeSelectorProps {
  scopeType: ScopeType;
}

// Cascading, multi-select, backed by directory/ (§6, §7). For roles whose scope
// value is locked to themselves (SE/ABM/RBM, §4), this renders a read-only badge
// instead of a free-text/picker input - the frontend must not let those roles
// query someone else's scope, since the API itself enforces nothing.
export function ScopeSelector({ scopeType }: ScopeSelectorProps) {
  const { user } = useAuth();
  const selection = useAppStore((s) => s.scopeSelection[scopeType] ?? []);
  const setScopeSelection = useAppStore((s) => s.setScopeSelection);

  const [stateFilter, setStateFilter] = useState<string>("");
  const [districtFilter, setDistrictFilter] = useState<string>("");
  const [nodeFilter, setNodeFilter] = useState<string>("");

  const statesQuery = useStates();
  const districtsQuery = useDistricts(stateFilter || undefined);
  const blocksQuery = useBlocks(stateFilter || undefined, districtFilter || undefined);
  const nodesQuery = useNodes(stateFilter || undefined);
  const sesQuery = useSEs(stateFilter || undefined, nodeFilter || undefined);
  const rbmsQuery = useRbms();
  const abmsQuery = useAbms();
  const zbmsQuery = useZbms();

  // A locked-to-self role (SE/ABM/RBM) never gets a picker to select themselves with
  // (see the read-only Badge returned below) - without this, scopeSelection[scopeType]
  // stays permanently empty and ScopeView never has anything to fetch a plan for. Only
  // ADMIN/NATIONAL logins had exercised this view before now, and neither role is
  // locked-to-self, so this had no way to surface until a real SE/ABM/RBM account did.
  useEffect(() => {
    if (!user || !isScopeValueLockedToSelf(user.role) || scopeType !== user.role) return;
    const own = ownScopeValue(user);
    if (own && (selection.length !== 1 || selection[0] !== own)) {
      setScopeSelection(scopeType, [own]);
    }
  }, [user, scopeType, selection, setScopeSelection]);

  if (user && isScopeValueLockedToSelf(user.role) && scopeType === user.role) {
    return (
      <Badge variant="outline" className="h-9 px-3">
        {user.role}: {ownScopeValue(user)}
      </Badge>
    );
  }

  const stateFilterControl = (
    <Select value={stateFilter || "__all"} onValueChange={(v) => {
      setStateFilter(v === "__all" ? "" : v);
      setDistrictFilter("");
      setNodeFilter("");
    }}>
      <SelectTrigger className="h-9 w-40">
        <SelectValue placeholder="State" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All states</SelectItem>
        {(statesQuery.data ?? []).map((s) => (
          <SelectItem key={s.state} value={s.state}>
            {s.state}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const districtFilterControl = (
    <Select
      value={districtFilter || "__all"}
      onValueChange={(v) => {
        setDistrictFilter(v === "__all" ? "" : v);
      }}
      disabled={!stateFilter}
    >
      <SelectTrigger className="h-9 w-40">
        <SelectValue placeholder="District" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All districts</SelectItem>
        {(districtsQuery.data ?? []).map((d) => (
          <SelectItem key={d.district} value={d.district}>
            {d.district}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const nodeFilterControl = (
    <Select value={nodeFilter || "__all"} onValueChange={(v) => setNodeFilter(v === "__all" ? "" : v)}>
      <SelectTrigger className="h-9 w-40">
        <SelectValue placeholder="Node" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All nodes</SelectItem>
        {(nodesQuery.data ?? []).map((n) => (
          <SelectItem key={n.node} value={n.node}>
            {n.node}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  let options: MultiSelectOption[] = [];
  let loading = false;
  let extraFilters: ReactNode = null;
  let placeholder = "Select...";

  switch (scopeType) {
    case "STATE":
      options = (statesQuery.data ?? []).map((s) => ({
        value: s.state,
        label: s.state,
        sublabel: `${s.node_count} nodes, ${s.se_count} SEs, ${s.dc_count} DCs`,
      }));
      loading = statesQuery.isLoading;
      placeholder = "Select state(s)";
      break;
    case "DISTRICT":
      options = (districtsQuery.data ?? []).map((d) => ({
        value: d.district,
        label: d.district,
        sublabel: `${d.block_count} blocks, ${d.dc_count} DCs`,
      }));
      loading = districtsQuery.isLoading;
      extraFilters = stateFilterControl;
      placeholder = stateFilter ? "Select district(s)" : "Pick a state first";
      break;
    case "BLOCK":
      options = (blocksQuery.data ?? []).map((b) => ({
        value: b.block,
        label: b.block,
        sublabel: `${b.dc_count} DCs`,
      }));
      loading = blocksQuery.isLoading;
      extraFilters = (
        <>
          {stateFilterControl}
          {districtFilterControl}
        </>
      );
      placeholder = districtFilter ? "Select block(s)" : "Pick state + district first";
      break;
    case "NODE":
      options = (nodesQuery.data ?? []).map((n) => ({
        value: n.node,
        label: n.node,
        sublabel: `${n.se_count} SEs, ${n.dc_count} DCs`,
      }));
      loading = nodesQuery.isLoading;
      extraFilters = stateFilterControl;
      placeholder = "Select node(s)";
      break;
    case "SE":
      // No display-name field exists for SEs anywhere in this data model - email is
      // both the value and the label (§6 directory/ses/).
      options = (sesQuery.data ?? []).map((se) => ({
        value: se.se_email,
        label: se.se_email,
        sublabel: `${se.dc_count} DCs`,
      }));
      loading = sesQuery.isLoading;
      extraFilters = (
        <>
          {stateFilterControl}
          {nodeFilterControl}
        </>
      );
      placeholder = "Select SE(s)";
      break;
    case "RBM":
      options = (rbmsQuery.data ?? []).map((r) => ({
        value: r.code,
        label: r.name ?? r.code,
        sublabel: `${r.states.length} states, ${r.dc_count} DCs`,
      }));
      loading = rbmsQuery.isLoading;
      placeholder = "Select RBM(s)";
      break;
    case "ABM":
      options = (abmsQuery.data ?? []).map((a) => ({
        value: a.code,
        label: a.name ?? a.code,
        sublabel: `${a.states.length} states, ${a.dc_count} DCs`,
      }));
      loading = abmsQuery.isLoading;
      placeholder = "Select ABM(s)";
      break;
    case "ZBM":
      options = (zbmsQuery.data ?? []).map((z) => ({
        value: z.code,
        label: z.name ?? z.code,
        sublabel: `covers ${z.states.length} states, ${z.dc_count} DCs`,
      }));
      loading = zbmsQuery.isLoading;
      placeholder = "Select ZBM / State Head(s)";
      break;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {extraFilters}
      <MultiSelectPopover
        options={options}
        selected={selection}
        onChange={(values) => setScopeSelection(scopeType, values)}
        placeholder={placeholder}
        loading={loading}
      />
    </div>
  );
}
