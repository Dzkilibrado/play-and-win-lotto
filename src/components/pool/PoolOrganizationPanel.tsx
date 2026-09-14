import { Archive, ArchiveRestore, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";

import { PoolDeleteDialog } from "@/components/pool/PoolDeleteDialog";
import { usePoolOrganizationActions } from "@/components/pool/usePoolOrganizationActions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { PoolRow } from "@/lib/services/poolService";

export function PoolOrganizationPanel({
  pool,
  canManage,
  onBack,
}: {
  pool: PoolRow;
  canManage: boolean;
  onBack: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const { archiveMutation } = usePoolOrganizationActions(pool.id);

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
      <header className="min-w-0 space-y-2">
        <Button variant="ghost" className="h-11 max-w-full justify-start px-2" onClick={onBack}>
          <span aria-hidden>←</span>
          <span className="truncate">{pool.name}</span>
        </Button>
        <div>
          <h2 className="font-display text-xl font-semibold text-text-primary">Organização</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Gerencie o ciclo de vida e as configurações administrativas deste bolão.
          </p>
        </div>
      </header>

      <section className="surface-card space-y-4 p-4" aria-labelledby="pool-organization-title">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-secondary text-text-secondary">
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="pool-organization-title" className="font-display text-base font-semibold text-text-primary">
              {archived ? "Restauração" : "Arquivamento"}
            </h2>
            <h3 className="mt-3 font-medium text-text-primary">
              {archived ? "Restaurar bolão" : "Arquivar bolão"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {archived
                ? "Retorna o bolão às listagens operacionais mantendo seu histórico."
                : "Retira o bolão das listas operacionais sem apagar participantes, jogos, pagamentos, comprovantes ou histórico."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="h-11 w-full sm:w-auto"
          disabled={archiveMutation.isPending}
          onClick={() => setArchiveConfirmOpen(true)}
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
      <ConfirmDialog
        open={archiveConfirmOpen}
        onOpenChange={setArchiveConfirmOpen}
        title={archived ? "Restaurar este bolão?" : "Arquivar este bolão?"}
        description={
          archived
            ? "O bolão voltará às listagens operacionais com todo o histórico preservado."
            : "O bolão sairá das listas operacionais, sem apagar participantes, jogos, pagamentos, comprovantes ou histórico."
        }
        confirmLabel={archived ? "Restaurar bolão" : "Arquivar bolão"}
        loadingLabel={archived ? "Restaurando…" : "Arquivando…"}
        loading={archiveMutation.isPending}
        onConfirm={() =>
          archiveMutation.mutate(!archived, {
            onSuccess: () => setArchiveConfirmOpen(false),
          })
        }
      />
    </div>
  );
}