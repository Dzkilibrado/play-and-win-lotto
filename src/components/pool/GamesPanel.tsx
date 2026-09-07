import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Link2, Ticket, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NumberBall } from "@/components/lottery/NumberBall";
import { EmptyState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { gameService } from "@/lib/services/gameService";
import { poolService, type PoolRow } from "@/lib/services/poolService";
import { gameStatusLabel, gameStatusTone, type GameStatus } from "@/types/domain";

export function GamesPanel({ pool, canManage }: { pool: PoolRow; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const contest = pool.contest_number ?? pool.contest_number_planned;

  const games = useQuery({
    queryKey: ["pool-games", pool.id],
    queryFn: () => poolService.games(pool.id),
  });

  const candidates = useQuery({
    queryKey: ["pool-game-candidates", pool.lotteries?.slug, contest],
    enabled: pickerOpen,
    queryFn: () =>
      gameService.listGames({
        lotterySlug: pool.lotteries?.slug ?? null,
        contestNumber: contest ?? null,
      }),
  });

  const attach = useMutation({
    mutationFn: (gameId: string) => poolService.attachGame(pool.id, gameId),
    onSuccess: () => {
      toast.success("Jogo vinculado ao bolão");
      setPickerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["pool-games", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const detach = useMutation({
    mutationFn: (gameId: string) => poolService.detachGame(pool.id, gameId),
    onSuccess: () => {
      toast.success("Jogo removido do bolão");
      void queryClient.invalidateQueries({ queryKey: ["pool-games", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = games.data ?? [];
  const totalCost = rows.reduce((sum, row) => sum + Number(row.generated_games?.cost ?? 0), 0);
  const linkedIds = new Set(rows.map((row) => row.game_id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          {rows.length} {rows.length === 1 ? "jogo" : "jogos"} · custo {formatCurrency(totalCost)}
        </p>
        {canManage ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-11" onClick={() => setPickerOpen(true)}>
              <Link2 className="size-4" aria-hidden />
              Vincular jogo existente
            </Button>
            <Button asChild size="sm" className="h-11">
              <Link to="/generate">Criar novo jogo</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Nenhum jogo neste bolão ainda"
          description="Vincule jogos que você já criou ou gere novos para este concurso."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const game = row.generated_games;
            const numbers = [...(game?.game_numbers ?? [])].sort((a, b) => a.number - b.number);
            return (
              <li key={row.id} className="surface-card space-y-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">
                      Jogo {game?.sequence_number ?? "—"} · {game?.numbers_count} dezenas
                    </p>
                    <p className="text-xs text-text-secondary">
                      {game?.contest_number ? `Concurso ${game.contest_number}` : "Concurso a definir"}
                      {game?.cost ? ` · ${formatCurrency(Number(game.cost))}` : ""}
                    </p>
                  </div>
                  {game?.status ? (
                    <StatusBadge
                      label={gameStatusLabel[game.status as GameStatus]}
                      tone={gameStatusTone[game.status as GameStatus]}
                    />
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {numbers.map((item) => (
                    <NumberBall key={item.number} value={item.number} size="sm" />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/games/$id" params={{ id: row.game_id }}>
                      Ver jogo
                    </Link>
                  </Button>
                  {canManage ? (
                    <Button variant="ghost" size="sm" onClick={() => detach.mutate(row.game_id)}>
                      <Unlink className="size-4" aria-hidden />
                      Remover do bolão
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular jogo existente</DialogTitle>
            <DialogDescription>
              Apenas jogos seus de {pool.lotteries?.name}
              {contest ? ` no concurso ${contest}` : ""} podem entrar neste bolão.
            </DialogDescription>
          </DialogHeader>
          {candidates.isLoading ? (
            <p className="text-sm text-text-secondary">Carregando seus jogos…</p>
          ) : (candidates.data ?? []).filter((game) => !linkedIds.has(game.id)).length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="Nenhum jogo disponível para vincular"
              description="Crie um jogo desta modalidade e concurso para adicioná-lo ao bolão."
            />
          ) : (
            <ul className="space-y-2">
              {(candidates.data ?? [])
                .filter((game) => !linkedIds.has(game.id))
                .map((game) => (
                  <li
                    key={game.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary">
                        Jogo {game.sequence_number ?? "—"} · {game.numbers_count} dezenas
                      </p>
                      <p className="text-xs text-text-secondary">
                        {game.contest_number ? `Concurso ${game.contest_number}` : "Concurso a definir"}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => attach.mutate(game.id)} disabled={attach.isPending}>
                      Vincular
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
