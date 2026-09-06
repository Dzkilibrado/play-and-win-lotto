import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users, Wallet, Clock, Trophy } from "lucide-react";

import { StatCard } from "@/components/common/Cards";
import { ActiveFilterChip, FilterBar } from "@/components/common/Filters";
import { SearchInput } from "@/components/common/SearchInput";
import { EmptyState } from "@/components/common/StateViews";
import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { poolStatusLabel } from "@/types/domain";
import { validateListSearch, type ListSearch } from "@/lib/searchFilters";

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

function PoolsPage() {
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
        title="Bolões"
        description="Organize participantes, cotas e pagamentos por concurso."
        actions={
          <Button asChild size="sm" className="h-11">
            <Link to="/pools/new">Novo bolão</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Abertos" value="0" icon={Users} to="/pools" search={{ status: "OPEN" }} />
        <StatCard
          label="Aguardando sorteio"
          value="0"
          icon={Clock}
          tone="info"
          to="/pools"
          search={{ status: "AWAITING_DRAW" }}
        />
        <StatCard
          label="Pagamentos pendentes"
          value="0"
          icon={Wallet}
          tone="warning"
          to="/pools"
          search={{ payment: "PENDING" }}
        />
        <StatCard
          label="Premiados"
          value="0"
          icon={Trophy}
          tone="success"
          to="/pools"
          search={{ status: "PRIZED" }}
        />
      </div>

      <FilterBar
        resultCount={0}
        onClearAll={() => navigate({ search: {} })}
        activeChips={chips.length ? chips : undefined}
        search={
          <SearchInput
            value={search.q ?? ""}
            onChange={(value) => setFilter({ q: value || undefined })}
            placeholder="Buscar bolão por nome ou concurso"
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

      <EmptyState
        icon={Users}
        title="Nenhum bolão encontrado com estes filtros"
        description="Crie um bolão para organizar participantes, cotas e pagamentos."
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

      <NotImplementedNotice
        title="Gestão de bolões em construção"
        description="A estrutura de dados já existe no banco. As telas de participantes, pagamentos e documentos serão ligadas na próxima fase."
      />
    </div>
  );
}
