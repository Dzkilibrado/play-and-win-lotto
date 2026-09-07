import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { GameCard } from "@/components/lottery/GameCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { appConfig } from "@/config/app.config";
import { resolveRules } from "@/lib/engine/rules";
import {
  automaticStatuses,
  gameDisplayName,
  gameStatusMeaning,
  manualStatuses,
  originLabel,
  statusWarning,
  type ContestSituation,
} from "@/lib/games/gameStatus";
import { gameService } from "@/lib/services/gameService";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { gameStatusLabel, gameStatusTone, type GameStatus } from "@/types/domain";
import { rowAnalysis } from "@/routes/_authenticated/games.index";

export const Route = createFileRoute("/_authenticated/games/$id")({
  head: () => ({
    meta: [
      { title: `Detalhe do jogo — ${appConfig.name}` },
      { name: "description", content: "Dezenas, análise e situação de um jogo." },
      { property: "og:title", content: `Detalhe do jogo — ${appConfig.name}` },
      { property: "og:description", content: "Dezenas, análise e situação de um jogo." },
    ],
  }),
  component: GameDetailPage,
});

function GameDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery({
    queryKey: ["game", id],
    queryFn: () => gameService.getGame(id),
  });
  const game = query.data ?? null;

  const contest = useQuery({
    queryKey: ["game-contest", game?.lotteries?.slug, game?.contest_number],
    enabled: Boolean(game?.lotteries?.slug && game?.contest_number),
    queryFn: () => lotteryDataService.resolveContest(game!.lotteries!.slug, game!.contest_number!),
  });

  const situation: ContestSituation = game?.contest_number
    ? (contest.data?.situation ?? "unknown")
    : "unknown";

  const changeStatus = async (status: GameStatus) => {
    try {
      await gameService.updateStatus(id, status);
      await query.refetch();
      toast.success("Situação atualizada.");
    } catch {
      toast.error("Não foi possível atualizar a situação.");
    }
  };

  const removeGame = async () => {
    try {
      await gameService.deleteGame(id);
      toast.success("Jogo excluído.");
      void navigate({ to: "/games" });
    } catch {
      toast.error("Não foi possível excluir este jogo.");
    }
  };

  const canDelete = game ? !automaticStatuses.includes(game.status) : false;

  return (
    <div className="space-y-4">
      <PageHeader
        title={game ? gameDisplayName(game.sequence_number) : "Detalhe do jogo"}
        description="Dezenas, análise e situação registrada por você."
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/games">Voltar</Link>
          </Button>
        }
      />

      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : null}

      {!query.isLoading && !query.isError && !game ? (
        <EmptyState
          title="Jogo não encontrado"
          description="Ele pode ter sido excluído ou pertence a outra conta."
          actions={
            <Button asChild size="sm">
              <Link to="/games">Ver meus jogos</Link>
            </Button>
          }
        />
      ) : null}

      {game ? (
        <>
          <GameCard
            title={gameDisplayName(game.sequence_number)}
            numbers={game.game_numbers.map((item) => item.number).sort((a, b) => a - b)}
            analysis={rowAnalysis(game)}
            lotteryName={resolveRules(game.lotteries?.slug)?.name ?? game.lotteries?.name ?? ""}
            colorKey={resolveRules(game.lotteries?.slug)?.colorKey ?? ""}
            contestNumber={game.contest_number}
            status={game.status}
            cost={game.cost}
            createdAt={game.created_at}
            origin={originLabel(game.source)}
            defaultExpanded
          />

          <section className="surface-card space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Situação do jogo
              </h2>
              <StatusBadge
                label={gameStatusLabel[game.status]}
                tone={gameStatusTone[game.status]}
              />
            </div>
            <p className="text-xs text-text-secondary">{gameStatusMeaning[game.status]}</p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-text-secondary">Você pode alterar para:</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {manualStatuses.map((status) => {
                  const warning = statusWarning(status, situation);
                  const current = game.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void changeStatus(status)}
                      aria-pressed={current}
                      className={`touch-target rounded-lg border p-3 text-left transition-colors ${
                        current
                          ? "border-lottery bg-lottery-soft"
                          : "border-border bg-surface hover:border-lottery"
                      }`}
                    >
                      <span className="block text-sm font-medium text-text-primary">
                        {gameStatusLabel[status]}
                      </span>
                      <span className="block text-xs text-text-secondary">
                        {gameStatusMeaning[status]}
                      </span>
                      {warning ? (
                        <span className="mt-1 block text-xs text-warning">{warning}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-text-secondary">
                Definidas automaticamente pela conferência (em desenvolvimento):
              </p>
              <div className="flex flex-wrap gap-2">
                {automaticStatuses.map((status) => (
                  <StatusBadge
                    key={status}
                    label={gameStatusLabel[status]}
                    tone={game.status === status ? gameStatusTone[status] : "neutral"}
                  />
                ))}
              </div>
            </div>
          </section>

          {game.notes ? (
            <section className="surface-card space-y-2 p-4">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Registro de origem
              </h2>
              <p className="break-words text-xs text-text-secondary">{game.notes}</p>
            </section>
          ) : null}

          <section className="surface-card space-y-2 p-4">
            <h2 className="font-display text-sm font-semibold text-text-primary">Excluir jogo</h2>
            <p className="text-xs text-text-secondary">
              {canDelete
                ? "A exclusão é definitiva e remove as dezenas e a análise deste jogo."
                : "Jogos já conferidos não podem ser excluídos."}
            </p>
            <Button
              variant="destructive"
              disabled={!canDelete}
              onClick={() => setConfirmOpen(true)}
            >
              Excluir jogo
            </Button>
          </section>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Excluir {gameDisplayName(game.sequence_number)}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => void removeGame()}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  );
}
