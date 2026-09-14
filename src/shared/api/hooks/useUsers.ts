import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/shared/api/endpoints";
import { queryKeys } from "@/shared/api/queryKeys";
import type { CreateUserPayload } from "@/shared/types/users";

// Admin Panel user management (added 2026-09-14) - no pagination/staleTime override,
// same reasoning as useRoutingOverrides: this list stays small (real employee
// accounts, not a 10k+-row universe).
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users(),
    queryFn: () => usersApi.list(),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => usersApi.setActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      usersApi.resetPassword(id, newPassword),
  });
}
