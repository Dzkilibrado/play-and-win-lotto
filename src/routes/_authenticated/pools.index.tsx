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
import { poolService } from "@/lib/services/poolService";
import { validateListSearch, type ListSearch } from "@/lib/searchFilters";
import { paymentStatusLabel, poolStatusLabel } from "@/types/domain";

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

const filterLabels: Partial<Record<keyof ListSearch, string>> = {
  q: "Busca",
  lottery: "Loteria",
  status: "Situação",
  payment: "Pagamento",
  contest: "Concurso",
  from: "De",
  to: "Até",
  sort: "Ordenação",
};

function PoolsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setFilter = (patch: Partial<ListSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const pools = useQuery({
    queryKey: ["pools", search],
    queryFn: () =>
      poolService.list({
        query: search.q ?? null,
        lotterySlug: search.lottery ?? null,
        status: search.status ?? null,
        payment: search.payment ?? null,
        contestNumber: search.contest ? Number(search.contest) : null,
        dateFrom: search.from ?? null,
        dateTo: search.to ?? null,
        sort: search.sort ?? null,
      }),
  });

  /*
   * Os indicadores no topo contam sempre todos os bolões. Quando nenhum filtro
   * está aplicado, a listagem já traz exatamente essa mesma lista — buscar de
   * novo faria a mesma consulta duas vezes a cada abertura da tela.
   */
  const hasFilters = (Object.entries(search) as [keyof ListSearch, string][]).some(
    ([key, value]) => key !== "page" && key !== "sort" && Boolean(value),
  );
  const all = useQuery({
    queryKey: ["pools", "all"],
    queryFn: () => poolService.list({}),
    enabled: hasFilters,
  });
  const rows = pools.data ?? [];
  const totals = hasFilters ? (all.data ?? []) : rows;


  const countByStatus = (status: string) => totals.filter((pool) => pool.status === status).length;
  const pendingPayments = totals.filter((pool) =>
    pool.pool_participants.some(
      (participant) =>
        participant.status === "ACTIVE" &&
        (participant.payment_status === "PENDING" ||
          participant.payment_status === "PARTIAL" ||
          participant.payment_status === "OVERDUE"),
    ),
  ).length;

  const chips = (Object.entries(search) as [keyof ListSearch, string][])
    .filter(([key, value]) => key !== "page" && value)
    .map(([key, value]) => (
      <ActiveFilterChip
        key={key}
        label={`${filterLabels[key] ?? key}: ${value}`}
        onRemove={() => setFilter({ [key]: undefined } as Partial<ListSearch>)}
      />
    ));

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
          search={{ status: "PRIZED" }}
        />
      </div>

      <FilterBar
        resultCount={pools.isLoading ? null : rows.length}
        onClearAll={() => navigate({ search: {} })}
        activeChips={chips.length ? chips : undefined}
        search={
          <SearchInput
            value={search.q ?? ""}
            onChange={(value) => setFilter({ q: value || undefined })}
            placeholder="Buscar bolão por nome"
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
              {Object.entries(poolStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </>
        }
        advancedFilters={
          <>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-secondary">Situação de pagamento</span>
              <select
                className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
                value={search.payment ?? ""}
                onChange={(event) => setFilter({ payment: event.target.value || undefined })}
              >
                <option value="">Qualquer situação</option>
                {Object.entries(paymentStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
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
            <option value="draw">Data do sorteio</option>
            <option value="name">Nome</option>
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
              <Button variant="outline" size="sm" onClick={() => navigate({ search: {} })}>
                Limpar filtros
              </Button>
              <Button asChild size="sm">
                <Link to="/pools/new">Novo bolão</Link>
              </Button>
            </>
          }
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
          {rows.map((pool) => (
            <PoolCard key={pool.id} pool={pool} />
          ))}
        </div>
      )}
    </div>
  );
}
