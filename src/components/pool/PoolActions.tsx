import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ReasonDialog } from "@/components/common/ReasonDialog";
import { PoolShareDialog } from "@/components/pool/PoolShareDialog";
import { PoolDeleteDialog } from "@/components/pool/PoolDeleteDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { poolNotices, poolStatusAction, poolStatusRequiresReason, poolStatusTransitions } from "@/config/pools.config";
import { poolService, type PoolRow } from "@/lib/services/poolService";
import { poolStatusLabel, type PoolStatus } from "@/types/domain";
import { userErrorMessage } from "@/lib/user-error";

export function PoolActions({ pool, canManage }: { pool: PoolRow; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [reasonTarget, setReasonTarget] = useState<PoolStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pool", pool.id, "participants"] });
    void queryClient.invalidateQueries({ queryKey: ["pool-games", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pool-events", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pools", "all"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: PoolStatus; reason?: string }) =>
      poolService.setStatus(pool.id, status, reason),
    onSuccess: () => {
      toast.success("Situação atualizada");
      setReasonTarget(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });
  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => poolService.setArchived(pool.id, archived),
    onSuccess: (_data, archived) => { toast.success(archived ? "Bolão arquivado" : "Bolão restaurado"); invalidate(); },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });

  const targets = poolStatusTransitions[pool.status];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="h-11" onClick={() => setShareOpen(true)}>
        <Share2 className="size-4" aria-hidden />
        Compartilhar
      </Button>

      {canManage && !pool.archived_at ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-11">
              Situação: {poolStatusLabel[pool.status]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mudar situação</DropdownMenuLabel>
            {targets.length === 0 ? (
              <DropdownMenuItem disabled>Nenhuma mudança disponível</DropdownMenuItem>
            ) : (
              targets.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => {
                    if (poolStatusRequiresReason.includes(status)) {
                      setReasonTarget(status);
                      return;
                    }
                    statusMutation.mutate({ status });
                  }}
                >
                  {poolStatusAction[status]}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {canManage ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-11" aria-label="Mais ações"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Organização</DropdownMenuLabel><DropdownMenuItem onSelect={() => archiveMutation.mutate(!pool.archived_at)}>{pool.archived_at ? <ArchiveRestore /> : <Archive />}{pool.archived_at ? "Restaurar bolão" : "Arquivar bolão"}</DropdownMenuItem><DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleteOpen(true)}><Trash2 />Excluir definitivamente</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}

      <PoolShareDialog
        pool={pool}
        open={shareOpen}
        onOpenChange={setShareOpen}
        canManage={canManage}
      />

      <ReasonDialog
        open={reasonTarget !== null}
        onOpenChange={(next) => (!next ? setReasonTarget(null) : undefined)}
        title="Cancelar bolão?"
        description={poolNotices.cancelPool}
        fieldLabel="Motivo do cancelamento"
        placeholder="Ex.: o grupo desistiu de apostar neste concurso."
        confirmLabel="Cancelar bolão"
        cancelLabel="Voltar"
        destructive
        loading={statusMutation.isPending}
        onConfirm={(reason) =>
          reasonTarget ? statusMutation.mutate({ status: reasonTarget, reason }) : undefined
        }
      />
      <PoolDeleteDialog pool={pool} open={deleteOpen} onOpenChange={setDeleteOpen} />

    </div>
  );
}
