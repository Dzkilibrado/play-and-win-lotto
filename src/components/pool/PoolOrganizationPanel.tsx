import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PoolDeleteDialog } from "@/components/pool/PoolDeleteDialog";
import { Button } from "@/components/ui/button";
import { poolService, type PoolRow } from "@/lib/services/poolService";
import { userErrorMessage } from "@/lib/user-error";

export function PoolOrganizationPanel({ pool, canManage }: { pool: PoolRow; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => poolService.setArchived(pool.id, archived),
    onSuccess: (_data, archived) => {
      toast.success(archived ? "Bolão arquivado" : "Bolão restaurado");
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool-events", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });

  if (!canManage) {
    return (
      <div className="surface-card p-4 text-sm text-text-secondary">
        Somente o organizador pode alterar o arquivamento ou excluir este bolão.
      </div>
    );
  }

  const archived = pool.archived_at !== null;

  return (
    <div className="space-y-4">
      <section className="surface-card space-y-4 p-4" aria-labelledby="pool-organization-title">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-secondary text-text-secondary">
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="pool-organization-title" className="font-display text-base font-semibold text-text-primary">
              {archived ? "Restaurar bolão" : "Arquivar bolão"}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {archived
                ? "Devolve o bolão às listas ativas e permite continuar sua organização."
                : "Retira o bolão das listas ativas sem apagar participantes, jogos ou histórico."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="h-11 w-full sm:w-auto"
          disabled={archiveMutation.isPending}
          onClick={() => archiveMutation.mutate(!archived)}
        >
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archiveMutation.isPending
            ? archived ? "Restaurando…" : "Arquivando…"
            : archived ? "Restaurar bolão" : "Arquivar bolão"}
        </Button>
      </section>

      <section className="rounded-lg border border-danger/40 bg-danger-soft p-4" aria-labelledby="pool-danger-zone-title">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="pool-danger-zone-title" className="font-display text-base font-semibold text-danger">
              Zona de risco
            </h2>
            <h3 className="mt-3 font-medium text-text-primary">Excluir definitivamente</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Remove permanentemente este bolão e seus dados específicos. Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          className="mt-4 h-11 w-full sm:w-auto"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 aria-hidden />
          Excluir definitivamente
        </Button>
      </section>

      <PoolDeleteDialog pool={pool} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}