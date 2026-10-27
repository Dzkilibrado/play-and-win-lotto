/**
 * Etapa 4 do fluxo "Criar jogo por orçamento": a partir da estratégia já
 * aprovada pelo usuário (Etapa 3), gera de fato os jogos de cada
 * modalidade, e depois oferece — por modalidade, já que um bolão pertence
 * a uma única modalidade no modelo atual — duas decisões independentes do
 * usuário:
 *
 *   1. salvar os jogos gerados daquela modalidade, ou não;
 *   2. criar um bolão com esses jogos, ou não — se sim, os jogos são
 *      salvos automaticamente (um bolão só pode referenciar jogos já
 *      salvos) e o usuário é levado para a tela de criação de bolão com a
 *      modalidade e os jogos já definidos, restando apenas nome e demais
 *      campos.
 *
 * Nenhuma modalidade é combinada em um único bolão — isso exigiria um
 * modelo de dados que o produto não tem hoje (pool_id → lottery_id é 1:1).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GameCard } from "@/components/lottery/GameCard";
import { useSession } from "@/hooks/useAuth";
import { useGameGeneration } from "@/lib/engine/useGameGeneration";
import type { GeneratedGameDraft } from "@/lib/engine/types";
import type { BudgetStrategyAllocation, BudgetStrategyResult } from "@/lib/engine/budgetStrategy";
import { gameService } from "@/lib/services/gameService";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { poolService } from "@/lib/services/poolService";
import { lotteryConfigs } from "@/config/lotteries";

interface ModalityState {
  allocation: BudgetStrategyAllocation;
  lotteryId: string | null;
  contestNumber: number | null;
  priceRowId: string | null;
  status: "pending" | "generating" | "done" | "error";
  games: GeneratedGameDraft[];
  error: string | null;
  savedGameIds: string[] | null; // null = ainda não salvo
  saving: boolean;
  creatingPool: boolean;
}

interface BudgetGenerationFlowProps {
  result: BudgetStrategyResult;
  onBack: () => void;
}

export function BudgetGenerationFlow({ result, onBack }: BudgetGenerationFlowProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const { generate } = useGameGeneration();
  const startedRef = useRef(false);

  const [states, setStates] = useState<ModalityState[]>(() =>
    result.allocations.map((allocation) => ({
      allocation,
      lotteryId: null,
      contestNumber: null,
      priceRowId: null,
      status: "pending",
      games: [],
      error: null,
      savedGameIds: null,
      saving: false,
      creatingPool: false,
    })),
  );

  const updateState = (slug: string, patch: Partial<ModalityState>) => {
    setStates((prev) =>
      prev.map((item) => (item.allocation.slug === slug ? { ...item, ...patch } : item)),
    );
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const runAll = async () => {
      const lotteries = await lotteryDataService.listLotteries();

      for (const allocation of result.allocations) {
        const slug = allocation.slug;
        updateState(slug, { status: "generating" });

        try {
          const lotteryRow = lotteries.find((row) => row.slug === slug) ?? null;
          const priceRow = lotteryRow
            ? await lotteryDataService.getActivePrice(lotteryRow.id, allocation.numbersSelected)
            : null;
          const lastDraw = (await lotteryDataService.listRecentResults(slug, 1))[0] ?? null;
          const lastNumbers =
            lastDraw?.draw_numbers?.map((item: { number: number }) => item.number) ?? null;
          const nextContest =
            lastDraw?.next_contest_number ?? (lastDraw ? lastDraw.contest_number + 1 : null);

          const outcome = await generate(
            {
              lotterySlug: slug,
              numbersCount: allocation.numbersSelected,
              gamesCount: allocation.gamesCount,
              fixed: [],
              excluded: [],
              filters: null,
              weights: null,
            },
            { lastDrawNumbers: lastNumbers, lastContestNumber: lastDraw?.contest_number ?? null },
          );

          if (!outcome || !outcome.validation.ok) {
            updateState(slug, {
              status: "error",
              error: outcome?.validation.issues[0]?.message ?? "Não foi possível gerar os jogos.",
            });
            continue;
          }

          updateState(slug, {
            status: "done",
            lotteryId: lotteryRow?.id ?? null,
            contestNumber: nextContest,
            priceRowId: priceRow?.id ?? null,
            games: outcome.games,
          });
        } catch (error) {
          updateState(slug, {
            status: "error",
            error: error instanceof Error ? error.message : "Não foi possível gerar os jogos.",
          });
        }
      }
    };

    void runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveModality = async (state: ModalityState): Promise<string[] | null> => {
    if (!user?.id || !state.lotteryId) {
      toast.error("Sessão não identificada. Entre novamente.");
      return null;
    }
    const slug = state.allocation.slug;
    updateState(slug, { saving: true });
    try {
      const ids: string[] = [];
      for (const draft of state.games) {
        const savedId = await gameService.saveGame({
          userId: user.id,
          lotteryId: state.lotteryId,
          numbers: draft.numbers,
          analysis: draft.analysis,
          contestNumber: state.contestNumber,
          drawId: null,
          price: state.priceRowId
            ? {
                priceId: state.priceRowId,
                price: state.allocation.pricePerGame,
                combinationCount: state.allocation.combinationsPerGame,
                source: null,
              }
            : null,
          constraints: null,
          strategy: null,
        });
        ids.push(savedId);
      }
      updateState(slug, { savedGameIds: ids });
      toast.success(
        ids.length === 1
          ? `Jogo de ${state.allocation.name} salvo.`
          : `${ids.length} jogos de ${state.allocation.name} salvos.`,
      );
      return ids;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
      return null;
    } finally {
      updateState(slug, { saving: false });
    }
  };

  const createPoolFor = async (state: ModalityState) => {
    const slug = state.allocation.slug;
    if (!state.lotteryId) return;
    updateState(slug, { creatingPool: true });
    try {
      const gameIds = state.savedGameIds ?? (await saveModality(state));
      if (!gameIds) return;
      await navigate({
        to: "/pools/new",
        search: { lotteryId: state.lotteryId, gameIds: gameIds.join(",") },
      });
    } finally {
      updateState(slug, { creatingPool: false });
    }
  };

  const allDone = states.every((state) => state.status === "done" || state.status === "error");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Jogos gerados a partir do orçamento</h2>
        <Button variant="outline" size="sm" onClick={onBack}>
          Voltar à estratégia
        </Button>
      </div>

      {states.map((state) => (
        <Card
          key={state.allocation.slug}
          data-lottery={lotteryConfigs[state.allocation.slug].colorKey}
        >
          <CardHeader>
            <CardTitle className="text-base">{state.allocation.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.status === "generating" && (
              <p className="text-sm text-muted-foreground">Gerando jogos…</p>
            )}

            {state.status === "error" && <p className="text-sm text-destructive">{state.error}</p>}

            {state.status === "done" && (
              <>
                <div className="space-y-2">
                  {state.games.map((game) => (
                    <GameCard
                      key={game.key}
                      title={`Jogo ${game.index}`}
                      numbers={game.numbers}
                      analysis={game.analysis}
                      lotteryName={state.allocation.name}
                      colorKey={lotteryConfigs[state.allocation.slug].colorKey}
                      cost={state.allocation.pricePerGame}
                      contestNumber={state.contestNumber}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant={state.savedGameIds ? "secondary" : "default"}
                    disabled={state.saving || Boolean(state.savedGameIds)}
                    onClick={() => void saveModality(state)}
                  >
                    {state.savedGameIds
                      ? "Jogos salvos"
                      : state.saving
                        ? "Salvando…"
                        : "Salvar jogos"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={state.creatingPool}
                    onClick={() => void createPoolFor(state)}
                  >
                    {state.creatingPool ? "Preparando bolão…" : "Criar bolão com esses jogos"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Criar um bolão salva os jogos automaticamente, se ainda não estiverem salvos.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {allDone && states.every((state) => state.status === "error") && (
        <p className="text-sm text-destructive">
          Não foi possível gerar jogos para nenhuma modalidade. Volte e ajuste a estratégia.
        </p>
      )}
    </div>
  );
}
