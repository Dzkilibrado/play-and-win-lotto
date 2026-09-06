import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";

import { ActiveFilterChip, FilterBar } from "@/components/common/Filters";
import { SearchInput } from "@/components/common/SearchInput";
import { EmptyState } from "@/components/common/StateViews";
import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { gameStatusLabel } from "@/types/domain";
import { validateListSearch, type ListSearch } from "@/lib/searchFilters";

export const Route = createFileRoute("/_authenticated/games/")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Meus Jogos — ${appConfig.name}` },
      { name: "description", content: "Todos os jogos registrados, com busca e filtros." },
      { property: "og:title", content: `Meus Jogos — ${appConfig.name}` },
      { property: "og:description", content: "Todos os jogos registrados, com busca e filtros." },
    ],
  }),
  component: GamesPage,
});

function GamesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setFilter = (patch: Partial<ListSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

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
        description="Jogos gerados no app. Um jogo gerado não é uma aposta oficial."
        actions={
          <Button asChild size="sm" className="h-11">
            <Link to="/generate">Gerar jogo</Link>
          </Button>
        }
      />

      <FilterBar
        resultCount={0}
        onClearAll={() => navigate({ search: {} })}
        activeChips={chips.length ? chips : undefined}
        search={
          <SearchInput
            value={search.q ?? ""}
            onChange={(value) => setFilter({ q: value || undefined })}
            placeholder="Buscar por concurso, dezenas ou bolão"
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
                <Label htmlFor="games-from">De</Label>
                <input
                  id="games-from"
                  type="date"
                  value={search.from ?? ""}
                  onChange={(event) => setFilter({ from: event.target.value || undefined })}
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="games-to">Até</Label>
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

      <EmptyState
        icon={ListChecks}
        title="Nenhum jogo encontrado com estes filtros"
        description="Você ainda não registrou jogos. O registro será liberado junto com o gerador."
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

      <NotImplementedNotice
        title="Registro e conferência ainda não implementados"
        description="A listagem está pronta para receber os jogos assim que o gerador e a conferência automática forem construídos."
      />
    </div>
  );
}
