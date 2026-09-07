/**
 * Interface única de compartilhamento do bolão.
 * Todos os botões "Compartilhar" do módulo abrem este diálogo — a mensagem,
 * o link e o tratamento de erro vêm de `@/lib/pools/poolShare`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canUseNativeShare,
  copyText,
  nativeShare,
  openWhatsApp,
  poolPublicUrl,
  poolShareMessage,
  poolShareTitle,
} from "@/lib/pools/poolShare";
import { poolService, type PoolRow } from "@/lib/services/poolService";

export function PoolShareDialog({
  pool,
  open,
  onOpenChange,
  canManage,
}: {
  pool: PoolRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const url = poolPublicUrl(pool);
  const message = poolShareMessage(pool, url);

  const enableLink = useMutation({
    mutationFn: () => poolService.setPublic(pool.id, true),
    onSuccess: () => {
      toast.success("Link público criado");
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool-events", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Ação explícita do organizador já é intenção suficiente: o link é criado
  // automaticamente ao abrir o compartilhamento, sem confirmação extra.
  const requested = useRef(false);
  useEffect(() => {
    if (!open) {
      requested.current = false;
      return;
    }
    if (url || !canManage || requested.current || enableLink.isPending) return;
    requested.current = true;
    enableLink.mutate();
  }, [open, url, canManage, enableLink]);

  const share = async () => {
    const result = await nativeShare({ title: poolShareTitle(pool), text: message, url });
    if (result === "shared") {
      toast.success("Bolão compartilhado");
      onOpenChange(false);
      return;
    }
    if (result === "cancelled") return;
    if (result === "error") {
      toast.error("Não foi possível abrir o compartilhamento. Use o WhatsApp ou copie o link.");
    }
  };

  const copy = async (value: string, label: string) => {
    const ok = await copyText(value);
    if (ok) toast.success(label);
    else toast.error("Não foi possível copiar. Selecione o texto manualmente.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[30rem] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compartilhar bolão</DialogTitle>
          <DialogDescription>
            {url
              ? "Quem receber o link vê apenas o acompanhamento geral do bolão."
              : canManage
                ? "Preparando o link público deste bolão…"
                : "Somente o organizador pode ativar o link público deste bolão."}
          </DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="space-y-3">
            <pre className="max-h-48 max-w-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg bg-surface-secondary p-3 text-xs text-text-secondary">
              {message}
            </pre>
            <div className="grid min-w-0 gap-2">
              {canUseNativeShare() ? (
                <Button className="h-11 justify-start" onClick={() => void share()}>
                  <Share2 className="size-4 shrink-0" aria-hidden />
                  Compartilhar…
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="h-11 justify-start"
                onClick={() => {
                  const ok = openWhatsApp(message);
                  if (!ok) toast.error("Não foi possível abrir o WhatsApp. Copie a mensagem abaixo.");
                }}
              >
                <MessageCircle className="size-4 shrink-0" aria-hidden />
                Compartilhar no WhatsApp
              </Button>
              <Button
                variant="outline"
                className="h-11 justify-start"
                onClick={() => void copy(url, "Link copiado")}
              >
                <Copy className="size-4 shrink-0" aria-hidden />
                Copiar link
              </Button>
              <Button
                variant="ghost"
                className="h-11 justify-start"
                onClick={() => void copy(message, "Mensagem copiada")}
              >
                <Copy className="size-4 shrink-0" aria-hidden />
                Copiar mensagem e link
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-surface-secondary p-3 text-sm text-text-secondary">
            {canManage
              ? "O link público mostra o acompanhamento do bolão: situação, cotas pagas, quem já confirmou e os jogos apostados. Telefones e valores individuais não aparecem."
              : "Somente o organizador pode ativar o link público deste bolão."}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
