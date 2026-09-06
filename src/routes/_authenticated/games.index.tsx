import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { useMemo } from "react";

import { ActiveFilterChip, FilterBar } from "@/components/common/Filters";
import { SearchInput } from "@/components/common/SearchInput";
import { StatCard } from "@/components/common/Cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { GameCard } from "@/components/lottery/GameCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { resolveRules } from "@/lib/engine/rules";
import type { GameAnalysisResult } from "@/lib/engine/types";
import { gameService, type GameRow } from "@/lib/services/gameService";
import { gameStatusLabel, type GameStatus } from "@/types/domain";
import { validateListSearch, type ListSearch } from "@/lib/searchFilters";

export const Route = createFileRoute("/_authenticated/games/")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Meus Jogos — ${appConfig.name}` },
      { name: "description", content: "Todos os jogos salvos, com busca e filtros." },
      { property: "og:title", content: `Meus Jogos — ${appConfig.name}` },
      { property: "og:description", content: "Todos os jogos salvos, com busca e filtros." },
    ],
  }),
  component: GamesPage,
});

/** Converte a análise persistida para o formato usado pelo GameCard. */
export function rowAnalysis(row: GameRow): GameAnalysisResult {
  const analysis = row.game_analysis?.[0];
  const numbers = row.game_numbers.map((item) => item.number).sort((a, b) => a - b);
  let maxGap = 0;
  for (let index = 1; index < numbers.length; index += 1) {
    maxGap = Math.max(maxGap, numbers[index]! - numbers[index - 1]!);
  }
  return {
    evenCount: analysis?.even_count ?? 0,
    oddCount: analysis?.odd_count ?? 0,
    sumTotal: analysis?.sum_total ?? 0,
    primeCount: analysis?.prime_count ?? 0,
    fibonacciCount: analysis?.fibonacci_count ?? 0,
    maxSequence: analysis?.max_sequence ?? 0,
    maxGap,
    rowDistribution: (analysis?.row_distribution as Record<string, number>) ?? {},
    columnDistribution: (analysis?.column_distribution as Record<string, number>) ?? {},
    repeatedFromLast: analysis?.repeated_from_last ?? null,
    comparedToContest: null,
  };
}

function GamesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setFilter = (patch: Partial<ListSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const query = useQuery({
    queryKey: ["games", search],
    queryFn: () =>
      gameService.listGames({
        lotterySlug: search.lottery ?? null,
        status: search.status ?? null,
        contestNumber: search.contest ? Number(search.contest) : null,
        numbersCount: search.numbers ? Number(search.numbers) : null,
        dateFrom: search.from ?? null,
        dateTo: search.to ?? null,
        sort: search.sort ?? null,
      }),
  });

  const rows = useMemo(() => {
    const all = query.data?.rows ?? [];
    const term = (search.q ?? "").trim().toLowerCase();
    if (!term) return all;
    return all.filter((row) => {
      const numbers = row.game_numbers.map((item) => String(item.number).padStart(2, "0")).join(" ");
      return (
        numbers.includes(term) ||
        String(row.contest_number ?? "").includes(term) ||
        (row.lotteries?.name.toLowerCase().includes(term) ?? false)
      );
    });
  }, [query.data, search.q]);

  const total = rows.length;
  const planned = rows.filter((row) => row.status === "PLANNED").length;
  const linked = rows.filter((row) => row.contest_number != null).length;

  const chips = (Object.entries(search) as [keyof ListSearch, string][])
    .filter(([key, value]) => key !== "page" && value)
    .map(([key, value]) => (
      <ActiveFilterChip
        key={key}
        label={`${key}: ${value}`}
        onRemove={() => setFilter({ [key]: undefined } as Partial<ListSearch>)}
      />
    ));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meus Jogos"
        description="Jogos salvos no app. Um jogo salvo não comprova aposta oficial."
        actions={
          <Button asChild size="sm" className="h-11">
            <Link to="/generate">Gerar jogo</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={total} icon={ListChecks} />
        <StatCard
          label="Planejados"
          value={planned}
          tone="info"
          to="/games"
          search={{ status: "PLANNED" }}
        />
        <StatCard label="Com concurso" value={linked} tone="success" />
      </div>

      <FilterBar
        resultCount={total}
        onClearAll={() => navigate({ search: {} })}
        activeChips={chips.length ? chips : undefined}
        search={
          <SearchInput
            value={search.q ?? ""}
            onChange={(value) => setFilter({ q: value || undefined })}
            placeholder="Buscar por concurso, dezenas ou modalidade"
          />
        }
        primaryFilters={
          <>
            <select
              aria-label="Modalidade"
              className="touch-target rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
              value={search.lottery ?? ""}
              onChange={(event) => setFilter({ lottery: event.target.value || undefined })}
            >
              <option value="">Todas as loterias</option>
              {activeLotteries.map((lottery) => (
                <option key={lottery.slug} value={lottery.slug}>
                  {lottery.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Situação"
              className="touch-target rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
              value={search.status ?? ""}
              onChange={(event) => setFilter({ status: event.target.value || undefined })}
            >
              <option value="">Todas as situações</option>
              {Object.entries(gameStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </>
        }
        sort={
          <select
            aria-label="Ordenação"
            className="touch-target rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
            value={search.sort ?? "recent"}
            onChange={(event) => setFilter({ sort: event.target.value })}
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="contest">Concurso</option>
          </select>
        }
        advancedFilters={
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="games-contest">Concurso</Label>
              <input
                id="games-contest"
                inputMode="numeric"
                value={search.contest ?? ""}
                onChange={(event) => setFilter({ contest: event.target.value || undefined })}
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="games-from">Criado de</Label>
                <input
                  id="games-from"
                  type="date"
                  value={search.from ?? ""}
                  onChange={(event) => setFilter({ from: event.target.value || undefined })}
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="games-to">Criado até</Label>
                <input
                  id="games-to"
                  type="date"
                  value={search.to ?? ""}
                  onChange={(event) => setFilter({ to: event.target.value || undefined })}
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="games-numbers">Quantidade de dezenas</Label>
              <input
                id="games-numbers"
                inputMode="numeric"
                value={search.numbers ?? ""}
                onChange={(event) => setFilter({ numbers: event.target.value || undefined })}
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </div>
          </div>
        }
      />

      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState onRetry={() => void query.refetch()} /> : null}

      {!query.isLoading && !query.isError && total === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nenhum jogo encontrado com estes filtros"
          description="Ajuste os filtros ou gere um novo jogo."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => navigate({ search: {} })}>
                Limpar filtros
              </Button>
              <Button asChild size="sm">
                <Link to="/generate">Ir para Gerar</Link>
              </Button>
            </>
          }
        />
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const rules = resolveRules(row.lotteries?.slug);
          return (
            <GameCard
              key={row.id}
              title={`Jogo ${row.id.slice(0, 8)}`}
              numbers={row.game_numbers.map((item) => item.number).sort((a, b) => a - b)}
              analysis={rowAnalysis(row)}
              lotteryName={rules?.name ?? row.lotteries?.name ?? ""}
              colorKey={rules?.colorKey ?? ""}
              contestNumber={row.contest_number}
              status={row.status as GameStatus}
              cost={row.cost}
              createdAt={row.created_at}
              to="/games/$id"
              params={{ id: row.id }}
            />
          );
        })}
      </div>
    </div>
  );
}
