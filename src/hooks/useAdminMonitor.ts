import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { MonitorSnapshot } from "@/config/adminMonitor";
import { supabase } from "@/integrations/supabase/client";
import { resolveMonitorEntries, type MonitorEntry, type MonitorPrefRow } from "@/lib/admin/monitor";

const snapshotKey = ["admin-monitor", "snapshot"] as const;
const prefsKey = ["admin-monitor", "prefs"] as const;

async function fetchSnapshot(): Promise<MonitorSnapshot> {
  const { data, error } = await supabase.rpc("admin_monitor_snapshot" as never);
  if (error) throw error;
  return data as unknown as MonitorSnapshot;
}

async function fetchPrefs(userId: string): Promise<MonitorPrefRow[]> {
  const { data, error } = await supabase
    .from("admin_monitor_prefs" as never)
    .select("item_key, enabled, position" as never)
    .eq("user_id" as never, userId as never);
  if (error) throw error;
  return (data ?? []) as unknown as MonitorPrefRow[];
}

/** Indicadores e preferências (itens e ordem) do Monitor do administrador. */
export function useAdminMonitor(userId: string) {
  const queryClient = useQueryClient();
  const snapshot = useQuery({
    queryKey: snapshotKey,
    queryFn: fetchSnapshot,
    refetchInterval: 60_000,
  });
  const prefs = useQuery({ queryKey: [...prefsKey, userId], queryFn: () => fetchPrefs(userId) });

  const save = useMutation({
    mutationFn: async (rows: MonitorPrefRow[]) => {
      const { error } = await supabase.from("admin_monitor_prefs" as never).upsert(
        rows.map((row) => ({
          ...row,
          user_id: userId,
          updated_at: new Date().toISOString(),
        })) as never,
        { onConflict: "user_id,item_key" } as never,
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...prefsKey, userId] }),
  });

  const entries: MonitorEntry[] = resolveMonitorEntries(prefs.data ?? []);
  return { snapshot, prefs, entries, save };
}
