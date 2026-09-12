/**
 * Interface única de compartilhamento do bolão.
 * Todos os botões "Compartilhar" do módulo abrem este diálogo — a mensagem,
 * o link e o tratamento de erro vêm de `@/lib/pools/poolShare`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2Off, MessageCircle, RefreshCw, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  poolShareScopeDescription,
  poolShareScopeLabel,
  poolShareTitle,
} from "@/lib/pools/poolShare";
import { poolService, type PoolRow, type PoolShareScope } from "@/lib/services/poolService";

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
  const [scope, setScope] = useState<PoolShareScope>("FULL");
  const url = poolPublicUrl(pool, scope);
  const message = poolShareMessage(pool, scope, url);

  const enableLink = useMutation({
    mutationFn: ({ enabled, regenerate = false }: { enabled: boolean; regenerate?: boolean }) =>
      poolService.setShareLink(pool.id, scope, enabled, regenerate),
    onSuccess: (_data, variables) => {
      toast.success(variables.enabled ? (variables.regenerate ? "Novo link criado" : "Link público criado") : "Link revogado");
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool-events", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Ação explícita do organizador já é intenção suficiente: o link é criado
  // automaticamente ao abrir o compartilhamento, sem confirmação extra.
  const requested = useRef<PoolShareScope | null>(null);
  useEffect(() => {
    if (!open) {
      requested.current = null;
      return;
    }
    if (url) {
      requested.current = null;
      return;
    }
    if (!canManage || requested.current === scope || enableLink.isPending) return;
    requested.current = scope;
    enableLink.mutate({ enabled: true });
  }, [open, url, scope, canManage, enableLink]);

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
              ? poolShareScopeDescription[scope]
              : canManage
                ? "Preparando o link público deste bolão…"
                : "Somente o organizador pode ativar o link público deste bolão."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de compartilhamento">
          {(["PARTICIPANTS", "GAMES", "FULL"] as PoolShareScope[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant={scope === item ? "default" : "outline"}
              className="h-auto min-h-11 whitespace-normal px-3 py-2 text-left"
              onClick={() => setScope(item)}
            >
              {poolShareScopeLabel[item]}
            </Button>
          ))}
        </div>

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
              {canManage ? (
                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                  <Button variant="outline" className="h-11" onClick={() => enableLink.mutate({ enabled: true, regenerate: true })}>
                    <RefreshCw className="size-4" aria-hidden /> Novo link
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => enableLink.mutate({ enabled: false })}>
                    <Link2Off className="size-4" aria-hidden /> Revogar
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-surface-secondary p-3 text-sm text-text-secondary">
            {canManage
              ? `Preparando o link de ${poolShareScopeLabel[scope].toLocaleLowerCase("pt-BR")}…`
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
