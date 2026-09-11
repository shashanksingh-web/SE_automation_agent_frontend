import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { routingOverridesApi } from "@/shared/api/endpoints";
import type { RoutingOverrideScopeType } from "@/shared/types/routingOverrides";

const QUERY_KEY = ["routing-overrides"] as const;

// Per-scope Routing ceiling overrides (added 2026-09-11). No pagination/search needed -
// this list is expected to stay small (a handful of nodes/states an admin has actually
// tuned), unlike DC Selection's 10k+-row universe.
export function useRoutingOverrides() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => routingOverridesApi.list(),
  });
}

export function useUpsertRoutingOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scopeType,
      scopeValue,
      fields,
      actor,
    }: {
      scopeType: RoutingOverrideScopeType;
      scopeValue: string;
      fields: Parameters<typeof routingOverridesApi.upsert>[2];
      actor?: string;
    }) => routingOverridesApi.upsert(scopeType, scopeValue, fields, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteRoutingOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scopeType, scopeValue }: { scopeType: RoutingOverrideScopeType; scopeValue: string }) =>
      routingOverridesApi.remove(scopeType, scopeValue),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
