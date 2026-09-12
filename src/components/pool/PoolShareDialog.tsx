/**
 * Interface única de compartilhamento do bolão.
 * Todos os botões "Compartilhar" do módulo abrem este diálogo — a mensagem,
 * o link e o tratamento de erro vêm de `@/lib/pools/poolShare`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2Off, MessageCircle, RefreshCw, Share2, Users, Ticket, LayoutList } from "lucide-react";
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
  poolSharePreview,
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
  const [scopeReady, setScopeReady] = useState(false);
  const url = poolPublicUrl(pool, scope);
  const message = poolShareMessage(pool, scope, url);
  const preview = poolSharePreview(pool, scope);

  useEffect(() => {
    if (!open) {
      setScopeReady(false);
      return;
    }
    if (typeof sessionStorage !== "undefined") {
      const saved = sessionStorage.getItem(`pool-share-scope:${pool.id}`);
      if (saved === "PARTICIPANTS" || saved === "GAMES" || saved === "FULL") setScope(saved);
    }
    setScopeReady(true);
  }, [open, pool.id]);

  const chooseScope = (next: PoolShareScope) => {
    setScope(next);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(`pool-share-scope:${pool.id}`, next);
  };

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
    if (!scopeReady || !canManage || requested.current === scope || enableLink.isPending) return;
    requested.current = scope;
    enableLink.mutate({ enabled: true });
  }, [open, url, scope, scopeReady, canManage, enableLink.isPending]);

  const share = async () => {
    const result = await nativeShare({ title: poolShareTitle(pool), text: message, url });
    if (result === "shared") {
      toast.success("Compartilhamento aberto");
      onOpenChange(false);
      return;
    }
    if (result === "cancelled") return;
    if (result === "unsupported") {
      await copy(message, "Mensagem e link copiados");
      return;
    }
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
      <DialogContent className="max-h-[90vh] max-w-[34rem] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Compartilhar bolão</DialogTitle>
          <DialogDescription>O que você quer compartilhar?</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Tipo de compartilhamento">
          {(["PARTICIPANTS", "GAMES", "FULL"] as PoolShareScope[]).map((item) => {
            const Icon = item === "PARTICIPANTS" ? Users : item === "GAMES" ? Ticket : LayoutList;
            return (
            <Button
              key={item}
              type="button"
              role="radio"
              aria-checked={scope === item}
              variant="outline"
              className={`h-auto min-h-14 justify-start whitespace-normal px-3 py-2 text-left ${scope === item ? "border-lottery bg-lottery-soft ring-1 ring-lottery" : ""}`}
              onClick={() => chooseScope(item)}
            >
              <Icon className="size-5 shrink-0 text-lottery" aria-hidden />
              <span><span className="block font-semibold">{poolShareScopeLabel[item]}</span><span className="block text-xs font-normal text-text-secondary">{poolShareScopeDescription[item]}</span></span>
            </Button>
          )})}
        </div>

        {scopeReady && url ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-surface-secondary p-3">
              <p className="text-xs font-semibold uppercase text-text-secondary">Será compartilhado</p>
              <ul className="mt-1.5 space-y-1 text-sm text-text-primary">{preview.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className="grid min-w-0 gap-2">
              <p className="text-xs font-semibold uppercase text-text-secondary">Compartilhar</p>
              <Button className="h-11 justify-start" onClick={() => void share()}>
                <Share2 className="size-4 shrink-0" aria-hidden />
                Compartilhar
                {!canUseNativeShare() ? <span className="sr-only"> copiando mensagem e link neste dispositivo</span> : null}
              </Button>
              <Button
                variant="outline"
                className="h-11 justify-start"
                onClick={() => {
                  const ok = openWhatsApp(message);
                  if (!ok) toast.error("Não foi possível abrir o WhatsApp. Copie a mensagem abaixo.");
                }}
              >
                <MessageCircle className="size-4 shrink-0" aria-hidden />
                WhatsApp
              </Button>
              <p className="mt-1 text-xs font-semibold uppercase text-text-secondary">Copiar</p>
              <Button
                variant="default"
                className="h-11 justify-start"
                onClick={() => void copy(message, "Mensagem e link copiados")}
              >
                <Copy className="size-4 shrink-0" aria-hidden />
                Copiar mensagem e link
              </Button>
              <Button
                variant="outline"
                className="h-11 justify-start"
                onClick={() => void copy(url, "Link copiado")}
              >
                <Copy className="size-4 shrink-0" aria-hidden />
                Copiar somente o link
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
