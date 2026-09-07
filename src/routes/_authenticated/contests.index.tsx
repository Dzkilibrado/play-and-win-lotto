import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { ActiveFilterChip, FilterBar } from "@/components/common/Filters";
import { SearchInput } from "@/components/common/SearchInput";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { activeLotteries, getLotteryConfig } from "@/config/lotteries";
import { ContestCard } from "@/components/lottery/ContestCard";
import { contestSearchService } from "@/lib/services/contestSearchService";
import {
  contestPageSizeOf,
  contestPageSizes,
  contestSituationLabel,
  contestSituationOf,
  contestSituationOptions,
  contestSortLabel,
  contestSortOf,
  contestSortOptions,
  formatNumbersLabel,
  parseNumbersParam,
} from "@/lib/contests/contestSearch";
import { formatDate } from "@/lib/format";
import { validateListSearch, type ListSearch } from "@/lib/searchFilters";

export const Route = createFileRoute("/_authenticated/contests/")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Concursos e Resultados — ${appConfig.name}` },
      {
        name: "description",
        content: "Consulte os sorteios oficiais por modalidade, concurso, período e dezenas.",
      },
      { property: "og:title", content: `Concursos e Resultados — ${appConfig.name}` },
      {
        property: "og:description",
        content: "Consulte os sorteios oficiais por modalidade, concurso, período e dezenas.",
      },
    ],
  }),
  component: ContestsPage,
});

function ContestsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (patch: Partial<ListSearch>) =>
    navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }) });

  const numbers = parseNumbersParam(search.numbers);
  const situation = contestSituationOf(search.status);
  const sort = contestSortOf(search.sort);
  const pageSize = contestPageSizeOf(search.size);
  const page = search.page ?? 1;
  const contestNumber = Number(search.q ?? search.contest);
  const lotteryConfig = getLotteryConfig(search.lottery ?? undefined);

  const contests = useQuery({
    queryKey: ["contest-search", { ...search, pageSize, page }],
    placeholderData: keepPreviousData,
    queryFn: () =>
      contestSearchService.search({
        lotterySlug: search.lottery ?? null,
        contestNumber: Number.isInteger(contestNumber) && contestNumber > 0 ? contestNumber : null,
        dateFrom: search.from ?? null,
        dateTo: search.to ?? null,
        situation,
        numbers,
        sort,
        page,
        pageSize,
      }),
  });

  const rows = contests.data?.rows ?? [];
  const total = contests.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const chips: { key: string; label: string; clear: Partial<ListSearch> }[] = [];
  if (search.lottery)
    chips.push({
      key: "lottery",
      label: lotteryConfig?.name ?? search.lottery,
      clear: { lottery: undefined },
    });
  if (Number.isInteger(contestNumber) && contestNumber > 0)
    chips.push({
      key: "contest",
      label: `Concurso ${contestNumber}`,
      clear: { q: undefined, contest: undefined },
    });
  if (search.from)
    chips.push({ key: "from", label: `A partir de ${formatDate(search.from)}`, clear: { from: undefined } });
  if (search.to)
    chips.push({ key: "to", label: `Até ${formatDate(search.to)}`, clear: { to: undefined } });
  if (situation)
    chips.push({
      key: "status",
      label: contestSituationLabel(situation)!,
      clear: { status: undefined },
    });
  if (numbers.length)
    chips.push({
      key: "numbers",
      label:
        numbers.length === 1
          ? `Contém dezena: ${formatNumbersLabel(numbers)}`
          : `Contém as dezenas: ${formatNumbersLabel(numbers)}`,
      clear: { numbers: undefined },
    });
  if (sort !== "recent")
    chips.push({ key: "sort", label: contestSortLabel(sort), clear: { sort: undefined } });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Concursos e Resultados"
        description="Sorteios oficiais consultados sempre no nosso banco."
      />

      <FilterBar
        resultCount={total}
        onClearAll={() => navigate({ search: {} })}
        activeChips={
          chips.length
            ? chips.map((chip) => (
                <ActiveFilterChip
                  key={chip.key}
                  label={chip.label}
                  onRemove={() => setFilter(chip.clear)}
                />
              ))
            : undefined
        }
        search={
          <SearchInput
            value={search.q ?? ""}
            onChange={(value) => setFilter({ q: value || undefined })}
            placeholder="Buscar pelo número do concurso"
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
              aria-label="Resultados por página"
              className="touch-target rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
              value={String(pageSize)}
              onChange={(event) => setFilter({ size: event.target.value })}
            >
              {contestPageSizes.map((value) => (
                <option key={value} value={value}>
                  {value} por página
                </option>
              ))}
            </select>
          </>
        }
        sort={
          <select
            aria-label="Ordenação"
            className="touch-target rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
            value={sort}
            onChange={(event) => setFilter({ sort: event.target.value })}
          >
            {contestSortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        }
        advancedFilters={
          <div className="space-y-3">
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
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Últimos 30 dias", days: 30 },
                { label: "Últimos 90 dias", days: 90 },
                { label: "Este ano", days: null },
              ].map((shortcut) => (
                <Button
                  key={shortcut.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11"
                  onClick={() => {
                    const today = new Date();
                    const from =
                      shortcut.days === null
                        ? new Date(today.getFullYear(), 0, 1)
                        : new Date(today.getTime() - shortcut.days * 86400000);
                    setFilter({
                      from: from.toISOString().slice(0, 10),
                      to: today.toISOString().slice(0, 10),
                    });
                  }}
                >
                  {shortcut.label}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="contest-situation">Situação</Label>
              <select
                id="contest-situation"
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={situation ?? ""}
                onChange={(event) => setFilter({ status: event.target.value || undefined })}
              >
                <option value="">Todas</option>
                {contestSituationOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="contest-numbers">Contém as dezenas</Label>
              <input
                id="contest-numbers"
                inputMode="numeric"
                placeholder="Ex.: 5, 17, 23"
                value={search.numbers ?? ""}
                onChange={(event) => setFilter({ numbers: event.target.value || undefined })}
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
              />
              <p className="text-xs text-text-secondary">
                Mostra apenas concursos em que todas as dezenas informadas saíram juntas.
              </p>
            </div>
          </div>
        }
      />

      {contests.isLoading ? (
        <LoadingState rows={4} />
      ) : contests.isError ? (
        <ErrorState onRetry={() => contests.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum concurso encontrado com estes filtros"
          description="Ajuste os filtros ou aguarde a próxima sincronização com a fonte oficial."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate({ search: {} })}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((contest) => (
              <ContestCard key={contest.id} contest={contest} />
            ))}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11"
              disabled={page <= 1}
              onClick={() => navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })}
            >
              Anterior
            </Button>
            <span className="text-center text-xs text-text-secondary">
              Página {page} de {totalPages} · {total} concursos
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-11"
              disabled={page >= totalPages}
              onClick={() => navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
