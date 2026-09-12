import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Link2, Ticket, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { NumberBall } from "@/components/lottery/NumberBall";
import { EmptyState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/common/SearchInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
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
    mutationFn: (gameIds: string[]) => poolService.attachGames(pool.id, gameIds),
    onSuccess: (count) => {
      toast.success(`${count} ${count === 1 ? "jogo vinculado" : "jogos vinculados"} ao bolão`);
      setPickerOpen(false);
      setSelectedIds(new Set());
      setQuery("");
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
  const available = (candidates.data?.rows ?? []).filter((game) => !linkedIds.has(game.id));
  const filteredAvailable = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return available;
    return available.filter((game) => {
      const sequence = String(game.sequence_number ?? "");
      return sequence.includes(term) || game.status.toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [available, query]);
  const publicable = rows.filter((row) => row.generated_games?.status !== "PLANNED").length;
  const hiddenFromPublic = rows.length - publicable;
  const allFilteredSelected = filteredAvailable.length > 0 && filteredAvailable.every((game) => selectedIds.has(game.id));

  const toggle = (gameId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(gameId);
      else next.delete(gameId);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          {rows.length} {rows.length === 1 ? "jogo vinculado" : "jogos vinculados"} · custo {formatCurrency(totalCost)}
        </p>
        {canManage ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-11" onClick={() => setPickerOpen(true)}>
              <Link2 className="size-4" aria-hidden />
              Vincular jogos
            </Button>
            <Button asChild size="sm" className="h-11">
              <Link to="/generate">Criar novo jogo</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {hiddenFromPublic > 0 ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {hiddenFromPublic} {hiddenFromPublic === 1 ? "jogo vinculado ainda não aparece" : "jogos vinculados ainda não aparecem"} no link público porque {hiddenFromPublic === 1 ? "está" : "estão"} como Planejado. Confirme a aposta na situação do jogo para liberar o acompanhamento.
        </p>
      ) : null}

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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => detach.mutate(row.game_id)}
                      disabled={detach.isPending}
                    >
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

      <Dialog open={pickerOpen} onOpenChange={(open) => {
        setPickerOpen(open);
        if (!open) {
          setSelectedIds(new Set());
          setQuery("");
        }
      }}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Vincular jogos</DialogTitle>
            <DialogDescription>
              Apenas jogos seus de {pool.lotteries?.name}
              {contest ? ` no concurso ${contest}` : ""} podem entrar neste bolão.
            </DialogDescription>
          </DialogHeader>
          {candidates.isLoading ? (
            <p className="text-sm text-text-secondary">Carregando seus jogos…</p>
          ) : available.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="Nenhum jogo disponível para vincular"
              description="Crie um jogo desta modalidade e concurso para adicioná-lo ao bolão."
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Buscar por número ou situação"
                ariaLabel="Buscar jogo para vincular"
              />
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-sm font-medium text-text-primary">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={(checked) => {
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      for (const game of filteredAvailable) {
                        if (checked) next.add(game.id);
                        else next.delete(game.id);
                      }
                      return next;
                    });
                  }}
                />
                Selecionar todos os elegíveis
              </label>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                <ul className="divide-y divide-border">
                  {filteredAvailable.map((game) => {
                    const numbers = [...game.game_numbers].sort((a, b) => a.position - b.position);
                    return (
                      <li key={game.id}>
                        <label className="flex min-w-0 cursor-pointer items-start gap-3 py-3">
                          <Checkbox
                            className="mt-0.5 size-5"
                            checked={selectedIds.has(game.id)}
                            onCheckedChange={(checked) => toggle(game.id, checked === true)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-text-primary">
                                Jogo {String(game.sequence_number ?? "—").padStart(2, "0")}
                              </span>
                              <StatusBadge label={gameStatusLabel[game.status]} tone={gameStatusTone[game.status]} />
                            </span>
                            <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium tabular-nums text-text-secondary">
                              {numbers.map((item) => <span key={item.number}>{String(item.number).padStart(2, "0")}</span>)}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-text-primary">
                  {selectedIds.size} {selectedIds.size === 1 ? "jogo selecionado" : "jogos selecionados"}
                </p>
                <Button
                  className="h-11"
                  disabled={selectedIds.size === 0 || attach.isPending}
                  onClick={() => attach.mutate([...selectedIds])}
                >
                  {attach.isPending
                    ? "Vinculando…"
                    : `Vincular ${selectedIds.size} ${selectedIds.size === 1 ? "jogo" : "jogos"}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
