import { useQuery } from "@tanstack/react-query";
import { directoryApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";

// §6 - dropdowns/typeaheads are driven entirely by these, never hardcoded lists.
export function useStates() {
  return useQuery({
    queryKey: queryKeys.directory.states(),
    queryFn: directoryApi.states,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNodes(state?: string) {
  return useQuery({
    queryKey: queryKeys.directory.nodes(state),
    queryFn: () => directoryApi.nodes({ state }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistricts(state: string | undefined) {
  return useQuery({
    queryKey: queryKeys.directory.districts(state ?? ""),
    queryFn: () => directoryApi.districts({ state: state! }),
    enabled: !!state,
    staleTime: 5 * 60 * 1000,
  });
}

// Every District network-wide, unscoped - for pickers that aren't nested under a State
// selection (e.g. RoutingOverridesPanel's scope-value multiselect), unlike useDistricts
// above which is the cascading State -> District dropdown flow.
export function useAllDistricts() {
  return useQuery({
    queryKey: queryKeys.directory.districts(""),
    queryFn: () => directoryApi.districts(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBlocks(state: string | undefined, district: string | undefined) {
  return useQuery({
    queryKey: queryKeys.directory.blocks(state ?? "", district ?? ""),
    queryFn: () => directoryApi.blocks({ state: state!, district: district! }),
    enabled: !!state && !!district,
    staleTime: 5 * 60 * 1000,
  });
}

export function useZbms() {
  return useQuery({
    queryKey: queryKeys.directory.zbms(),
    queryFn: directoryApi.zbms,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRbms() {
  return useQuery({
    queryKey: queryKeys.directory.rbms(),
    queryFn: directoryApi.rbms,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAbms() {
  return useQuery({
    queryKey: queryKeys.directory.abms(),
    queryFn: directoryApi.abms,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSEs(state?: string, node?: string) {
  return useQuery({
    queryKey: queryKeys.directory.ses(state, node),
    queryFn: () => directoryApi.ses({ state, node }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDCs(
  params: {
    state?: string;
    node?: string;
    se?: string;
    limit?: number;
    offset?: number;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.directory.dcs(params),
    queryFn: () => directoryApi.dcs(params),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled,
  });
}
