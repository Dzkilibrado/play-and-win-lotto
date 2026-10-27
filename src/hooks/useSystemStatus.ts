import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface SystemStatus {
  maintenance: boolean;
  reason: string | null;
}

export const systemStatusKey = ["system-status"] as const;

/** Situação geral do sistema. Em caso de falha de leitura, nunca bloqueia o usuário. */
export async function fetchSystemStatus(): Promise<SystemStatus> {
  try {
    const { data, error } = await supabase.rpc("get_system_status" as never);
    if (error || !data) return { maintenance: false, reason: null };
    const value = data as unknown as { maintenance?: boolean; reason?: string | null };
    return { maintenance: value.maintenance === true, reason: value.reason ?? null };
  } catch {
    return { maintenance: false, reason: null };
  }
}

export function useSystemStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: systemStatusKey,
    queryFn: fetchSystemStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  return {
    status: query.data ?? { maintenance: false, reason: null },
    isLoading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: systemStatusKey }),
  };
}
