import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useTuffFanOutCreate } from "@/shared/api/hooks/useTuff";
import type { DateSelection } from "@/shared/types/scope";

type TuffScopeType = "SE" | "ABM" | "RBM" | "NODE" | "BLOCK" | "DISTRICT" | "STATE";

interface CreateOrRefreshButtonProps {
  scopeType: TuffScopeType;
  scopeValues: string[];
  date: DateSelection;
}

// Fires GET /tuff/<SCOPE_TYPE>/<scope_value>/ per selected value (§9, §15) - this
// is the combined normalization + generation call, works directly off whatever
// scope is selected without requiring drill-down to individual SEs.
export function CreateOrRefreshButton({ scopeType, scopeValues, date }: CreateOrRefreshButtonProps) {
  const mutation = useTuffFanOutCreate();

  return (
    <Button
      size="sm"
      disabled={scopeValues.length === 0 || mutation.isPending}
      onClick={() => mutation.mutate({ scopeType, scopeValues, date })}
      className="gap-1.5"
    >
      {mutation.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      Create / Refresh
    </Button>
  );
}
