import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { ActiveFilterChip, FilterBar } from "@/components/common/Filters";
import { SearchInput } from "@/components/common/SearchInput";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { validateListSearch, type ListSearch } from "@/lib/searchFilters";

export const Route = createFileRoute("/_authenticated/contests/")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Concursos — ${appConfig.name}` },
      { name: "description", content: "Histórico de concursos com busca e filtros." },
      { property: "og:title", content: `Concursos — ${appConfig.name}` },
      { property: "og:description", content: "Histórico de concursos com busca e filtros." },
    ],
  }),
  component: ContestsPage,
});

function ContestsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (patch: Partial<ListSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const contests = useQuery({
    queryKey: ["contests", search],
    queryFn: () =>
      lotteryDataService.listContests({
        lotterySlug: search.lottery ?? null,
        contestNumber: search.contest ? Number(search.contest) : null,
        dateFrom: search.from ?? null,
        dateTo: search.to ?? null,
        accumulated: search.status === "accumulated" ? "yes" : null,
        sort: (search.sort as "recent" | "oldest" | "prize" | undefined) ?? "recent",
        page: search.page ?? 1,
      }),
  });

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
      <PageHeader title="Concursos" description="Todos os concursos importados para o banco." />

      <FilterBar
        resultCount={contests.data?.total ?? 0}
        onClearAll={() => navigate({ search: {} })}
        activeChips={chips.length ? chips : undefined}
        search={
          <SearchInput
            value={search.q ?? ""}
            onChange={(value) => setFilter({ q: value || undefined })}
            placeholder="Buscar concurso"
          />
        }
        primaryFilters={
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
            <option value="prize">Maior prêmio</option>
          </select>
        }
        advancedFilters={
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="contest-number">Número do concurso</Label>
              <input
                id="contest-number"
                inputMode="numeric"
                value={search.contest ?? ""}
                onChange={(event) => setFilter({ contest: event.target.value || undefined })}
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="contest-from">De</Label>
                <input
                  id="contest-from"
                  type="date"
                  value={search.from ?? ""}
                  onChange={(event) => setFilter({ from: event.target.value || undefined })}
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contest-to">Até</Label>
                <input
                  id="contest-to"
                  type="date"
                  value={search.to ?? ""}
                  onChange={(event) => setFilter({ to: event.target.value || undefined })}
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="contest-acc">Acumulado</Label>
              <select
                id="contest-acc"
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={search.status ?? ""}
                onChange={(event) => setFilter({ status: event.target.value || undefined })}
              >
                <option value="">Indiferente</option>
                <option value="accumulated">Somente acumulados</option>
              </select>
            </div>
          </div>
        }
      />

      {contests.isLoading ? (
        <LoadingState rows={4} />
      ) : contests.isError ? (
        <ErrorState onRetry={() => contests.refetch()} />
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum concurso encontrado com estes filtros"
          description="Os concursos aparecerão aqui após a sincronização com a fonte oficial."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate({ search: {} })}>
              Limpar filtros
            </Button>
          }
        />
      )}
    </div>
  );
}
