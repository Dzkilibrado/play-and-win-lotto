import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link as LinkIcon, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { poolNotices, poolStatusAction, poolStatusRequiresReason, poolStatusTransitions } from "@/config/pools.config";
import { formatCurrency, formatDate } from "@/lib/format";
import { poolService, type PoolRow } from "@/lib/services/poolService";
import { poolStatusLabel, type PoolStatus } from "@/types/domain";

function shareText(pool: PoolRow, url: string | null) {
  const contest = pool.contest_number ?? pool.contest_number_planned;
  const drawDate = pool.draw_date ?? pool.draw_date_planned;
  const lines = [
    `Bolão: ${pool.name}`,
    `Modalidade: ${pool.lotteries?.name ?? "—"}`,
    contest ? `Concurso: ${contest}` : "Concurso: a definir",
    drawDate ? `Sorteio: ${formatDate(drawDate)}` : null,
    `Valor da cota: ${formatCurrency(pool.quota_value)}`,
    `Cotas: ${pool.total_quotas}`,
    url ? `Acompanhe: ${url}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function PoolActions({ pool, canManage }: { pool: PoolRow; canManage: boolean }) {
  const queryClient = useQueryClient();

  const publicUrl =
    pool.is_public && pool.public_token && typeof window !== "undefined"
      ? `${window.location.origin}/b/${pool.public_token}`
      : null;

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
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publicMutation = useMutation({
    mutationFn: (enabled: boolean) => poolService.setPublic(pool.id, enabled),
    onSuccess: (_data, enabled) => {
      toast.success(enabled ? "Link público criado" : "Link público revogado");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const share = async () => {
    const text = shareText(pool, publicUrl);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: pool.name, text });
        return;
      } catch {
        // usuário cancelou o compartilhamento
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const targets = poolStatusTransitions[pool.status];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="h-11" onClick={() => void share()}>
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
                      const reason = window.prompt(
                        `${poolNotices.cancelPool}\n\nMotivo do cancelamento:`,
                      );
                      if (!reason?.trim()) return;
                      statusMutation.mutate({ status, reason: reason.trim() });
                      return;
                    }
                    statusMutation.mutate({ status });
                  }}
                >
                  {poolStatusAction[status]}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Link público</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => publicMutation.mutate(!pool.is_public)}>
              <LinkIcon className="size-4" aria-hidden />
              {pool.is_public ? "Revogar link público" : "Criar link público"}
            </DropdownMenuItem>
            {publicUrl ? (
              <DropdownMenuItem
                onSelect={() => {
                  void navigator.clipboard.writeText(publicUrl);
                  toast.success("Link copiado");
                }}
              >
                <Copy className="size-4" aria-hidden />
                Copiar link
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
