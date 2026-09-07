import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { EmptyState, LoadingState } from "@/components/common/StateViews";
import { formatDate } from "@/lib/format";
import { poolService } from "@/lib/services/poolService";

export function DocumentsPanel({ poolId }: { poolId: string }) {
  const documents = useQuery({
    queryKey: ["pool-documents", poolId],
    queryFn: () => poolService.documents(poolId),
  });

  if (documents.isLoading) return <LoadingState rows={2} />;
  const rows = documents.data ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nenhum comprovante anexado a este bolão"
        description="Os comprovantes enviados nos jogos deste bolão aparecem aqui."
      />
    );
  }

  return (
    <ul className="surface-card divide-y divide-border p-4">
      {rows.map((document) => (
        <li key={document.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="truncate text-text-primary">{document.kind}</span>
          <span className="shrink-0 text-xs text-text-secondary">{formatDate(document.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
