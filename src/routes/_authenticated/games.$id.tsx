import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { GameCard } from "@/components/lottery/GameCard";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { resolveRules } from "@/lib/engine/rules";
import { gameService } from "@/lib/services/gameService";
import { gameStatusLabel, type GameStatus } from "@/types/domain";
import { rowAnalysis } from "@/routes/_authenticated/games.index";

const MANUAL_STATUSES: GameStatus[] = ["PLANNED", "BET", "RECEIPTED", "AWAITING_DRAW"];

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

  const query = useQuery({
    queryKey: ["game", id],
    queryFn: () => gameService.getGame(id),
  });
  const game = query.data ?? null;

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
      toast.error("Só é possível excluir jogos ainda planejados.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Detalhe do jogo"
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
            title={`Jogo ${game.id.slice(0, 8)}`}
            numbers={game.game_numbers.map((item) => item.number).sort((a, b) => a - b)}
            analysis={rowAnalysis(game)}
            lotteryName={resolveRules(game.lotteries?.slug)?.name ?? game.lotteries?.name ?? ""}
            colorKey={resolveRules(game.lotteries?.slug)?.colorKey ?? ""}
            contestNumber={game.contest_number}
            status={game.status}
            cost={game.cost}
            createdAt={game.created_at}
            defaultExpanded
          />

          <section className="surface-card space-y-3 p-4">
            <h2 className="font-display text-sm font-semibold text-text-primary">Situação</h2>
            <div className="flex flex-wrap gap-2">
              {MANUAL_STATUSES.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={game.status === status ? "default" : "outline"}
                  onClick={() => void changeStatus(status)}
                >
                  {gameStatusLabel[status]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              Conferido, Premiado e Não premiado são definidos pela conferência automática, ainda em
              desenvolvimento.
            </p>
          </section>

          {game.notes ? (
            <section className="surface-card space-y-2 p-4">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Registro de origem
              </h2>
              <p className="break-words text-xs text-text-secondary">{game.notes}</p>
            </section>
          ) : null}

          {game.status === "PLANNED" ? (
            <Button variant="destructive" onClick={() => void removeGame()}>
              Excluir jogo
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
