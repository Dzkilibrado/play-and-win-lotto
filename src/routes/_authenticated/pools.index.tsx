import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clock, Trophy, Users, Wallet } from "lucide-react";

import { StatCard } from "@/components/common/Cards";
import { ActiveFilterChip, FilterBar } from "@/components/common/Filters";
import { SearchInput } from "@/components/common/SearchInput";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { PoolCard } from "@/components/pool/PoolCard";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { poolConfig } from "@/config/pools.config";
import { useSession } from "@/hooks/useAuth";
import {
  applyPoolView,
  paginatePools,
  poolGroupLabel,
  poolGroupOf,
  poolGroups,
  poolHasPendingPayment,
  poolSortLabel,
  poolSortOf,
  poolSortOptions,
  statusesForGroup,
} from "@/lib/pools/poolFilters";
import { normalizeName } from "@/lib/pools/publicPool";
import { poolService } from "@/lib/services/poolService";
import { validateListSearch, type ListSearch } from "@/lib/searchFilters";
import { poolStatusLabel } from "@/types/domain";

export const Route = createFileRoute("/_authenticated/pools/")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Bolões — ${appConfig.name}` },
      { name: "description", content: "Bolões, participantes, cotas e pagamentos." },
      { property: "og:title", content: `Bolões — ${appConfig.name}` },
      { property: "og:description", content: "Bolões, participantes, cotas e pagamentos." },
    ],
  }),
  component: PoolsPage,
});

/** Rótulo curto e legível de cada filtro ativo, para os chips. */
function chipLabel(key: keyof ListSearch, value: string, lotteryName: (slug: string) => string) {
  switch (key) {
    case "q":
      return `Busca: ${value}`;
    case "group":
      return poolGroupLabel(value);
    case "status":
      return `Situação: ${poolStatusLabel[value as keyof typeof poolStatusLabel] ?? value}`;
    case "lottery":
      return lotteryName(value);
    case "contest":
      return `Concurso ${value}`;
    case "from":
      return `Criado de ${value}`;
    case "to":
      return `Criado até ${value}`;
    case "payment":
      return "Pagamentos pendentes";
    case "games":
      return value === "with" ? "Com jogos" : "Sem jogos";
    case "prize":
      return "Premiados";
    case "scope":
      return value === "owner" ? "Organizados por mim" : "Dos quais participo";
    case "sort":
      return `Ordem: ${poolSortLabel(value)}`;
    default:
      return `${key}: ${value}`;
  }
}

function PoolsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = useSession();

  // Ao mudar qualquer filtro, o carregamento progressivo volta ao início.
  const setFilter = (patch: Partial<ListSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) });

  /*
   * Uma única leitura da lista autorizada; busca, filtros, ordenação e
   * carregamento progressivo acontecem sobre ela. Assim os indicadores do topo
   * continuam contando o total mesmo com a listagem filtrada, sem uma segunda
   * consulta ao banco a cada abertura da tela.
   */
  const pools = useQuery({ queryKey: ["pools", "all"], queryFn: () => poolService.list({}) });
  const all = pools.data ?? [];

  const lotteryName = (slug: string) =>
    activeLotteries.find((lottery) => lottery.slug === slug)?.name ?? slug;

  const term = normalizeName(search.q ?? "");
  const searched = term
    ? all.filter((pool) => normalizeName(pool.name).includes(term))
    : all;
  const byLottery = search.lottery
    ? searched.filter((pool) => pool.lotteries?.slug === search.lottery)
    : searched;
  const byContest = search.contest
    ? byLottery.filter(
        (pool) =>
          String(pool.contest_number ?? "") === search.contest ||
          String(pool.contest_number_planned ?? "") === search.contest,
      )
    : byLottery;
  const byPeriod = byContest.filter((pool) => {
    const created = pool.created_at.slice(0, 10);
    if (search.from && created < search.from) return false;
    if (search.to && created > search.to) return false;
    return true;
  });

  const rows = applyPoolView(byPeriod, {
    group: search.group,
    status: search.status,
    payment: search.payment,
    games: search.games,
    prize: search.prize,
    scope: search.scope,
    sort: search.sort,
    userId: user?.id ?? null,
  });

  const page = search.page ?? 1;
  const { visible, hasMore, nextPage } = paginatePools(rows, page, poolConfig.pageSize);
  const single = rows.length === 1;

  const countByStatus = (status: string) => all.filter((pool) => pool.status === status).length;
  const pendingPayments = all.filter(poolHasPendingPayment).length;

  const group = poolGroupOf(search.group);
  const detailStatuses = statusesForGroup(group) ?? (Object.keys(poolStatusLabel) as string[]);

  const chipKeys: (keyof ListSearch)[] = [
    "q",
    "group",
    "status",
    "lottery",
    "contest",
    "from",
    "to",
    "payment",
    "games",
    "prize",
    "scope",
    "sort",
  ];
  const chips = chipKeys
    .filter((key) => Boolean(search[key]))
    .map((key) => (
      <ActiveFilterChip
        key={key}
        label={chipLabel(key, String(search[key]), lotteryName)}
        onRemove={() => setFilter({ [key]: undefined } as Partial<ListSearch>)}
      />
    ));

  const clearAll = () => navigate({ search: {} });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bolões"
        description="Organize participantes, cotas e pagamentos por concurso."
        actions={
          <Button asChild size="sm" className="h-11">
            <Link to="/pools/new">Novo bolão</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Abertos"
          value={countByStatus("OPEN")}
          icon={Users}
          to="/pools"
          search={{ status: "OPEN" }}
        />
        <StatCard
          label="Aguardando sorteio"
          value={countByStatus("AWAITING_DRAW")}
          icon={Clock}
          tone="info"
          to="/pools"
          search={{ status: "AWAITING_DRAW" }}
        />
        <StatCard
          label="Pagamentos pendentes"
          value={pendingPayments}
          icon={Wallet}
          tone="warning"
          to="/pools"
          search={{ payment: "PENDING" }}
        />
        <StatCard
          label="Premiados"
          value={countByStatus("PRIZED")}
          icon={Trophy}
          tone="success"
          to="/pools"
          search={{ prize: "PRIZED" }}
        />
      </div>

      <FilterBar
        resultCount={pools.isLoading ? null : rows.length}
        onClearAll={clearAll}
        activeChips={chips.length ? chips : undefined}
        search={
          <SearchInput
            value={search.q ?? ""}
            onChange={(value) => setFilter({ q: value || undefined })}
            placeholder="Buscar bolão por nome"
          />
        }
        primaryFilters={
          <div
            role="group"
            aria-label="Situação"
            className="flex min-w-0 flex-wrap items-center gap-1.5"
          >
            {poolGroups.map((item) => {
              const activeGroup = item.id === group;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={activeGroup}
                  onClick={() =>
                    setFilter({
                      group: item.id === "all" ? undefined : item.id,
                      // A situação detalhada pertence ao grupo anterior.
                      status: undefined,
                    })
                  }
                  className={
                    activeGroup
                      ? "tappable inline-flex min-h-9 items-center rounded-full bg-lottery px-3 text-xs font-semibold text-lottery-foreground"
                      : "tappable inline-flex min-h-9 items-center rounded-full bg-surface-secondary px-3 text-xs font-medium text-text-primary hover:bg-border"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        }
        advancedFilters={
          <>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-secondary">Situação detalhada</span>
              <select
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
                value={search.status ?? ""}
                onChange={(event) => setFilter({ status: event.target.value || undefined })}
              >
                <option value="">Todas deste grupo</option>
                {detailStatuses.map((value) => (
                  <option key={value} value={value}>
                    {poolStatusLabel[value as keyof typeof poolStatusLabel]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-secondary">Modalidade</span>
              <select
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
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
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-secondary">Concurso</span>
              <input
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
                inputMode="numeric"
                value={search.contest ?? ""}
                onChange={(event) => setFilter({ contest: event.target.value || undefined })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1.5 text-sm">
                <span className="text-text-secondary">Criado de</span>
                <input
                  type="date"
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
                  value={search.from ?? ""}
                  onChange={(event) => setFilter({ from: event.target.value || undefined })}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-text-secondary">Criado até</span>
                <input
                  type="date"
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
                  value={search.to ?? ""}
                  onChange={(event) => setFilter({ to: event.target.value || undefined })}
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-secondary">Jogos</span>
              <select
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
                value={search.games ?? ""}
                onChange={(event) => setFilter({ games: event.target.value || undefined })}
              >
                <option value="">Tanto faz</option>
                <option value="with">Com jogos</option>
                <option value="without">Sem jogos</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-secondary">Meus bolões</span>
              <select
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
                value={search.scope ?? ""}
                onChange={(event) => setFilter({ scope: event.target.value || undefined })}
              >
                <option value="">Todos que posso ver</option>
                <option value="owner">Organizados por mim</option>
                <option value="member">Dos quais participo</option>
              </select>
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={search.payment === "PENDING"}
                  onChange={(event) =>
                    setFilter({ payment: event.target.checked ? "PENDING" : undefined })
                  }
                />
                Somente com pagamentos pendentes
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={search.prize === "PRIZED"}
                  onChange={(event) =>
                    setFilter({ prize: event.target.checked ? "PRIZED" : undefined })
                  }
                />
                Somente premiados
              </label>
            </div>
          </>
        }
        sort={
          <select
            aria-label="Ordenação"
            className="touch-target rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
            value={poolSortOf(search.sort)}
            onChange={(event) => setFilter({ sort: event.target.value })}
          >
            {poolSortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        }
      />

      {pools.isLoading ? (
        <LoadingState rows={3} label="Carregando bolões…" />
      ) : pools.isError ? (
        <ErrorState onRetry={() => void pools.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum bolão encontrado com estes filtros"
          description="Ajuste os filtros ou crie um bolão para organizar participantes, cotas e pagamentos."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Limpar filtros
              </Button>
              <Button asChild size="sm">
                <Link to="/pools/new">Novo bolão</Link>
              </Button>
            </>
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
            {visible.map((pool) => (
              // Resultado único fica destacado, mas continua sendo a listagem.
              <PoolCard
                key={pool.id}
                pool={pool}
                {...(single ? { className: "border-lottery lg:col-span-2" } : {})}
              />
            ))}
          </div>
          {hasMore ? (
            <Button
              variant="outline"
              className="h-11 w-full"
              onClick={() => navigate({ search: (prev) => ({ ...prev, page: nextPage }) })}
            >
              Carregar mais ({rows.length - visible.length} restantes)
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
