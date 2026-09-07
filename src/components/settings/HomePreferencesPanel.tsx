/**
 * Personalização da tela inicial: blocos exibidos, ordem, modalidades
 * acompanhadas e modalidade favorita. Persistência imediata com aviso
 * discreto — o usuário nunca perde uma alteração por esquecer de salvar.
 */
import { useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LoadingState } from "@/components/common/StateViews";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  getHomeBlockDefinition,
  homePreferencesNotice,
  moveBlock,
  noFollowedLotteriesNotice,
  type HomeBlockKey,
} from "@/config/home.config";
import { useHomePreferences } from "@/hooks/useHomePreferences";

export function HomePreferencesPanel() {
  const prefs = useHomePreferences();
  const [confirmReset, setConfirmReset] = useState(false);

  if (prefs.loading) return <LoadingState rows={2} label="Carregando preferências…" />;

  const persist = async (patch: Parameters<typeof prefs.save>[0], message: string) => {
    try {
      await prefs.save(patch);
      toast.success(message);
    } catch {
      toast.error("Não foi possível salvar sua preferência. Tente novamente.");
    }
  };

  const toggleBlock = (key: HomeBlockKey, enabled: boolean) => {
    const blocks = prefs.blocks.map((block) => (block.key === key ? { ...block, enabled } : block));
    void persist({ homeBlocks: blocks }, enabled ? "Bloco ativado." : "Bloco ocultado.");
  };

  const move = (key: HomeBlockKey, direction: -1 | 1) => {
    const blocks = moveBlock(prefs.blocks, key, direction);
    if (blocks === prefs.blocks) return;
    void persist({ homeBlocks: blocks }, "Ordem atualizada.");
  };

  const toggleLottery = (id: string, followed: boolean) => {
    const next = followed
      ? [...prefs.followedIds, id]
      : prefs.followedIds.filter((item) => item !== id);
    const favorite = prefs.favoriteId && next.includes(prefs.favoriteId) ? prefs.favoriteId : null;
    void persist(
      { followedLotteryIds: next, favoriteLotteryId: favorite },
      "Loterias acompanhadas atualizadas.",
    );
  };

  const changeFavorite = (id: string) => {
    void persist({ favoriteLotteryId: id === "" ? null : id }, "Loteria favorita atualizada.");
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-text-primary">
            O que mostrar na tela inicial
          </h3>
          <p className="text-xs text-text-secondary">
            Marque os blocos e use as setas para definir a ordem.
          </p>
        </div>

        <ul className="space-y-2">
          {prefs.blocks.map((block, index) => {
            const definition = getHomeBlockDefinition(block.key);
            return (
              <li
                key={block.key}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface-secondary p-3"
              >
                <Checkbox
                  id={`block-${block.key}`}
                  checked={block.enabled}
                  onCheckedChange={(value) => toggleBlock(block.key, value === true)}
                  aria-label={`Mostrar ${definition.label} na tela inicial`}
                />
                <Label htmlFor={`block-${block.key}`} className="min-w-0 cursor-pointer">
                  <span className="block truncate text-sm font-medium text-text-primary">
                    {definition.label}
                  </span>
                  <span className="block text-xs font-normal text-text-secondary">
                    {definition.description}
                  </span>
                </Label>
                <span className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-11"
                    disabled={index === 0}
                    onClick={() => move(block.key, -1)}
                    aria-label={`Mover ${definition.label} para cima`}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-11"
                    disabled={index === prefs.blocks.length - 1}
                    onClick={() => move(block.key, 1)}
                    aria-label={`Mover ${definition.label} para baixo`}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-text-primary">
            Loterias que quero acompanhar
          </h3>
          <p className="text-xs text-text-secondary">{homePreferencesNotice}</p>
        </div>

        <ul className="space-y-2">
          {prefs.lotteries.map((lottery) => {
            const checked = prefs.followedIds.includes(lottery.id);
            return (
              <li
                key={lottery.id}
                data-lottery={lottery.config.colorKey}
                className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3"
              >
                <Checkbox
                  id={`lottery-${lottery.id}`}
                  checked={checked}
                  onCheckedChange={(value) => toggleLottery(lottery.id, value === true)}
                />
                <Label
                  htmlFor={`lottery-${lottery.id}`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-text-primary"
                >
                  <span className="size-2.5 shrink-0 rounded-full bg-lottery" aria-hidden />
                  <span className="truncate">{lottery.name}</span>
                </Label>
              </li>
            );
          })}
        </ul>

        {prefs.followedIds.length === 0 ? (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
            {noFollowedLotteriesNotice}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <Label htmlFor="favorite-lottery" className="text-sm font-semibold text-text-primary">
          Loteria favorita
        </Label>
        <p className="text-xs text-text-secondary">
          A favorita aparece primeiro na tela inicial e já vem selecionada em Criar jogo. As demais
          continuam disponíveis normalmente.
        </p>
        <select
          id="favorite-lottery"
          value={prefs.favoriteId ?? ""}
          onChange={(event) => changeFavorite(event.target.value)}
          className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
        >
          <option value="">Nenhuma favorita</option>
          {prefs.followedLotteries.map((lottery) => (
            <option key={lottery.id} value={lottery.id}>
              {lottery.name}
            </option>
          ))}
        </select>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => setConfirmReset(true)}
        >
          <RotateCcw className="size-4" aria-hidden />
          Restaurar padrão
        </Button>
        <span className="text-xs text-text-secondary">
          {prefs.saving ? "Salvando…" : "Alterações são salvas automaticamente."}
        </span>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Restaurar padrão da tela inicial?"
        description="Os blocos, a ordem e as loterias acompanhadas voltam ao padrão, e nenhuma favorita fica marcada. Nenhum jogo, bolão ou conferência é apagado."
        confirmLabel="Restaurar"
        loading={prefs.resetting}
        onConfirm={async () => {
          try {
            await prefs.reset();
            toast.success("Preferências restauradas.");
          } catch {
            toast.error("Não foi possível restaurar as preferências.");
          }
          setConfirmReset(false);
        }}
      />
    </div>
  );
}
