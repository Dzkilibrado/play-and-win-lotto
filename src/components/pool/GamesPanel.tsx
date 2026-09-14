import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Link2, RefreshCw, Ticket, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { NumberBall } from "@/components/lottery/NumberBall";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { automaticStatuses, manualStatuses } from "@/lib/games/gameStatus";
import { gameService } from "@/lib/services/gameService";
import { poolService, type PoolRow } from "@/lib/services/poolService";
import { userErrorMessage } from "@/lib/user-error";
import type { PoolGameEligibility } from "@/lib/services/poolService";
import { gameStatusLabel, gameStatusTone, type GameStatus } from "@/types/domain";
import { resolveQueryState } from "@/lib/query/queryState";
import { useSession } from "@/hooks/useAuth";

export function GamesPanel({ pool, canManage }: { pool: PoolRow; canManage: boolean }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLinkedIds, setSelectedLinkedIds] = useState<Set<string>>(new Set());
  const [statusOpen, setStatusOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<GameStatus | "">("");
  const [query, setQuery] = useState("");
  const contest = pool.contest_number ?? pool.contest_number_planned;

  const games = useQuery({
    queryKey: ["pool-games", pool.id, user.id],
    queryFn: () => poolService.games(pool.id),
  });

  const candidates = useQuery({
    queryKey: ["pool-game-candidates", pool.id, user.id],
    enabled: pickerOpen,
    queryFn: () => gameService.listGames({}),
  });

  const candidateIds = (candidates.data?.rows ?? []).slice(0, 200).map((game) => game.id);
  const classifications = useQuery({
    queryKey: ["pool-game-eligibility", pool.id, user.id, candidateIds],
    enabled: pickerOpen && candidateIds.length > 0,
    queryFn: () => poolService.classifyGames(pool.id, candidateIds),
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
      void queryClient.invalidateQueries({ queryKey: ["pool-game-candidates", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool-game-eligibility", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });

  const detach = useMutation({
    mutationFn: (gameId: string) => poolService.detachGame(pool.id, gameId),
    onSuccess: () => {
      toast.success("Jogo removido do bolão");
      void queryClient.invalidateQueries({ queryKey: ["pool-games", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool-game-candidates", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool-game-eligibility", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });

  const changeStatus = useMutation({
    mutationFn: () => {
      if (!targetStatus) throw new Error("Escolha a nova situação.");
      return poolService.setGamesStatus(pool.id, [...selectedLinkedIds], targetStatus);
    },
    onSuccess: (count) => {
      toast.success(`Situação alterada em ${count} ${count === 1 ? "jogo" : "jogos"}`);
      setStatusOpen(false);
      setSelectedLinkedIds(new Set());
      setTargetStatus("");
      void queryClient.invalidateQueries({ queryKey: ["pool-games", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });

  const rows = games.data ?? [];
  const gamesState = resolveQueryState(games);
  const totalCost = rows.reduce((sum, row) => sum + Number(row.generated_games?.cost ?? 0), 0);
  const classificationById = new Map((classifications.data ?? []).map((item) => [item.game_id, item]));
  const candidateRows = (candidates.data?.rows ?? []).slice(0, 200);
  const eligible = candidateRows.filter((game) => classificationById.get(game.id)?.eligibility === "AVAILABLE");
  const filteredCandidates = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return candidateRows;
    return candidateRows.filter((game) => {
      const sequence = String(game.sequence_number ?? "");
      return sequence.includes(term) || game.status.toLocaleLowerCase("pt-BR").includes(term);
    });
  }, [candidateRows, query]);
  const filteredEligible = filteredCandidates.filter((game) => classificationById.get(game.id)?.eligibility === "AVAILABLE");
  const confirmedBets = rows.filter((row) => row.generated_games?.status !== "PLANNED").length;
  const planned = rows.length - confirmedBets;
  const allFilteredSelected = filteredEligible.length > 0 && filteredEligible.every((game) => selectedIds.has(game.id));
  const editableRows = rows.filter((row) => manualStatuses.includes(row.generated_games?.status as GameStatus));
  const allEditableSelected = editableRows.length > 0 && editableRows.every((row) => selectedLinkedIds.has(row.game_id));

  const toggle = (gameId: string, checked: boolean) => {
    if (classificationById.get(gameId)?.eligibility !== "AVAILABLE") return;
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

      {canManage && editableRows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium text-text-primary">
            <Checkbox
              checked={allEditableSelected}
              onCheckedChange={(checked) => {
                setSelectedLinkedIds(checked ? new Set(editableRows.map((row) => row.game_id)) : new Set());
              }}
            />
            Selecionar todos
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">
              {selectedLinkedIds.size} {selectedLinkedIds.size === 1 ? "jogo selecionado" : "jogos selecionados"}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedLinkedIds.size === 0}
              onClick={() => setStatusOpen(true)}
            >
              <RefreshCw className="size-4" aria-hidden />
              Alterar situação
            </Button>
          </div>
        </div>
      ) : null}

      {planned > 0 ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {planned} {planned === 1 ? "jogo vinculado aparece" : "jogos vinculados aparecem"} no link público como {planned === 1 ? "Planejado" : "Planejados"}. {confirmedBets} {confirmedBets === 1 ? "aposta confirmada" : "apostas confirmadas"}.
        </p>
      ) : null}

      {gamesState === "loading" ? (
        <LoadingState rows={3} label="Carregando jogos do bolão…" />
      ) : gamesState === "error" ? (
        <ErrorState onRetry={() => void games.refetch()} />
      ) : rows.length === 0 ? (
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
                  <div className="flex min-w-0 items-start gap-3">
                    {canManage && game?.status && !automaticStatuses.includes(game.status as GameStatus) ? (
                      <Checkbox
                        className="mt-0.5 size-5"
                        aria-label={`Selecionar jogo ${game.sequence_number ?? ""}`}
                        checked={selectedLinkedIds.has(row.game_id)}
                        onCheckedChange={(checked) => {
                          setSelectedLinkedIds((current) => {
                            const next = new Set(current);
                            if (checked) next.add(row.game_id);
                            else next.delete(row.game_id);
                            return next;
                          });
                        }}
                      />
                    ) : null}
                    <div className="min-w-0">
                    <p className="font-medium text-text-primary">
                      Jogo {game?.sequence_number ?? "—"} · {game?.numbers_count} dezenas
                    </p>
                    <p className="text-xs text-text-secondary">
                      {game?.contest_number ? `Concurso ${game.contest_number}` : "Concurso a definir"}
                      {game?.cost ? ` · ${formatCurrency(Number(game.cost))}` : ""}
                    </p>
                    </div>
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
          {candidates.isLoading || classifications.isLoading ? (
            <p className="text-sm text-text-secondary">Carregando seus jogos…</p>
          ) : classifications.isError ? (
            <div className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
              Não foi possível verificar os vínculos. Feche esta tela e tente novamente.
            </div>
          ) : candidateRows.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="Nenhum jogo encontrado"
              description="Crie um jogo para verificar se ele pode entrar neste bolão."
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
                      for (const game of filteredEligible) {
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
                  {filteredCandidates.map((game) => {
                    const numbers = [...game.game_numbers].sort((a, b) => a.position - b.position);
                    const classification = classificationById.get(game.id);
                    const eligibility = classification?.eligibility ?? "INELIGIBLE";
                    const selectable = eligibility === "AVAILABLE";
                    const reason = eligibilityLabel(eligibility, classification?.linked_pool_name ?? null);
                    return (
                      <li key={game.id}>
                        <label className={`flex min-w-0 items-start gap-3 py-3 ${selectable ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}>
                          <Checkbox
                            className="mt-0.5 size-5"
                            disabled={!selectable}
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
                            <span className={`mt-0.5 block text-xs ${selectable ? "text-success" : "text-text-secondary"}`}>
                              {reason}
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
                {eligible.length === 0 ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Nenhum dos jogos exibidos está disponível para este bolão.
                  </p>
                ) : null}
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

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar situação</DialogTitle>
            <DialogDescription>
              A nova situação será aplicada aos {selectedLinkedIds.size} jogos ou nenhuma alteração será feita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={targetStatus} onValueChange={(value) => setTargetStatus(value as GameStatus)}>
              <SelectTrigger className="h-11" aria-label="Nova situação dos jogos">
                <SelectValue placeholder="Escolha a nova situação" />
              </SelectTrigger>
              <SelectContent>
                {manualStatuses.map((status) => (
                  <SelectItem key={status} value={status}>{gameStatusLabel[status]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-secondary">
              Conferido, Premiado e Não premiado são definidos exclusivamente pela conferência oficial.
            </p>
            <Button
              className="h-11 w-full"
              disabled={!targetStatus || changeStatus.isPending}
              onClick={() => changeStatus.mutate()}
            >
              {changeStatus.isPending ? "Alterando…" : `Alterar ${selectedLinkedIds.size} ${selectedLinkedIds.size === 1 ? "jogo" : "jogos"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function eligibilityLabel(eligibility: PoolGameEligibility, linkedPoolName: string | null) {
  switch (eligibility) {
    case "AVAILABLE": return "Disponível para vincular";
    case "LINKED_HERE": return "Já vinculado a este bolão";
    case "LINKED_OTHER": return linkedPoolName ? `Vinculado a outro bolão: ${linkedPoolName}` : "Vinculado a outro bolão";
    case "INCOMPATIBLE_LOTTERY": return "Incompatível: outra modalidade";
    case "INCOMPATIBLE_CONTEST": return "Incompatível: outro concurso";
    case "POOL_CLOSED": return "Este bolão não aceita novos jogos";
    default: return "Não elegível para vínculo";
  }
}
