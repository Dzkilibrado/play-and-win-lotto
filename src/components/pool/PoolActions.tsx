import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link as LinkIcon, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ReasonDialog } from "@/components/common/ReasonDialog";
import { PoolShareDialog } from "@/components/pool/PoolShareDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { poolNotices, poolStatusAction, poolStatusRequiresReason, poolStatusTransitions } from "@/config/pools.config";
import { copyText, poolPublicUrl } from "@/lib/pools/poolShare";
import { poolService, type PoolRow } from "@/lib/services/poolService";
import { poolStatusLabel, type PoolStatus } from "@/types/domain";

export function PoolActions({ pool, canManage }: { pool: PoolRow; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [reasonTarget, setReasonTarget] = useState<PoolStatus | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  const publicUrl = poolPublicUrl(pool);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pool-events", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pools"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: PoolStatus; reason?: string }) =>
      poolService.setStatus(pool.id, status, reason),
    onSuccess: () => {
      toast.success("Situação atualizada");
      setReasonTarget(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Criar link é ação direta: não pedimos confirmação. Revogar e gerar um link
  // novo invalidam um endereço já compartilhado, por isso continuam confirmando.
  const publicMutation = useMutation({
    mutationFn: (enabled: boolean) => poolService.setPublic(pool.id, enabled),
    onSuccess: (_data, enabled) => {
      toast.success(enabled ? "Link público criado" : "Link público revogado");
      setRevokeOpen(false);
      invalidate();
      if (enabled) setShareOpen(true);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      await poolService.setPublic(pool.id, false);
      return poolService.setPublic(pool.id, true);
    },
    onSuccess: () => {
      toast.success("Novo link público criado");
      setRegenerateOpen(false);
      invalidate();
      setShareOpen(true);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const targets = poolStatusTransitions[pool.status];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="h-11" onClick={() => setShareOpen(true)}>
        <Share2 className="size-4" aria-hidden />
        Compartilhar
      </Button>

      {canManage ? (
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
            <DropdownMenuLabel>Link público</DropdownMenuLabel>
            {pool.is_public ? (
              <>
                <DropdownMenuItem onSelect={() => setRegenerateOpen(true)}>
                  <LinkIcon className="size-4" aria-hidden />
                  Gerar novo link
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setRevokeOpen(true)}>
                  <LinkIcon className="size-4" aria-hidden />
                  Revogar link público
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onSelect={() => publicMutation.mutate(true)}>
                <LinkIcon className="size-4" aria-hidden />
                Criar link público
              </DropdownMenuItem>
            )}
            {publicUrl ? (
              <DropdownMenuItem
                onSelect={() => {
                  void copyText(publicUrl).then((ok) =>
                    ok ? toast.success("Link copiado") : toast.error("Não foi possível copiar o link."),
                  );
                }}
              >
                <Copy className="size-4" aria-hidden />
                Copiar link
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

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

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revogar link público?"
        description="Quem já tem o link deixa de conseguir acompanhar o bolão. Você pode criar um link novo depois, mas ele será diferente."
        confirmLabel="Revogar link"
        cancelLabel="Manter link"
        destructive
        loading={publicMutation.isPending}
        onConfirm={() => publicMutation.mutate(false)}
      />

      <ConfirmDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        title="Gerar um novo link público?"
        description="O link atual deixa de funcionar imediatamente. Quem já recebeu o endereço antigo precisará do novo link para continuar acompanhando o bolão."
        confirmLabel="Gerar novo link"
        cancelLabel="Manter link atual"
        destructive
        loading={regenerateMutation.isPending}
        onConfirm={() => regenerateMutation.mutate()}
      />
    </div>
  );
}
