import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { EmptyState, LoadingState } from "@/components/common/StateViews";
import { poolService } from "@/lib/services/poolService";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function HistoryPanel({ poolId }: { poolId: string }) {
  const events = useQuery({
    queryKey: ["pool-events", poolId],
    queryFn: () => poolService.events(poolId),
  });

  if (events.isLoading) return <LoadingState rows={3} />;
  const rows = events.data ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhum registro no histórico ainda"
        description="Cada mudança importante do bolão aparece aqui automaticamente."
      />
    );
  }

  return (
    <ol className="surface-card divide-y divide-border p-4">
      {rows.map((event) => (
        <li key={event.id} className="py-2 first:pt-0 last:pb-0">
          <p className="text-sm text-text-primary">{event.description}</p>
          <p className="text-xs text-text-secondary">{dateTime.format(new Date(event.created_at))}</p>
        </li>
      ))}
    </ol>
  );
}
