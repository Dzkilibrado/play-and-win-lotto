import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Clock, Flag, Layers3, Trophy, Users } from "lucide-react";

import { StatCard } from "@/components/common/Cards";
import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { filterPools } from "@/lib/pools/poolFilters";
import { poolService } from "@/lib/services/poolService";
import { privateQueryKeys } from "@/lib/query/privateQueryKeys";
import { resolveQueryState } from "@/lib/query/queryState";

export const Route = createFileRoute("/_authenticated/pools/")({
  head: () => ({
    meta: [
      { title: `Bolões — ${appConfig.name}` },
      { name: "description", content: "Organize e acompanhe seus bolões por situação." },
      { property: "og:title", content: `Bolões — ${appConfig.name}` },
      { property: "og:description", content: "Organize e acompanhe seus bolões por situação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PoolsHubPage,
});

function PoolsHubPage() {
  const { user } = Route.useRouteContext();
  const pools = useQuery({ queryKey: privateQueryKeys.poolsAll(user.id), queryFn: () => poolService.list({}) });
  const queryState = resolveQueryState(pools);
  const all = queryState === "success" ? (pools.data ?? []) : [];
  const active = all.filter((pool) => !pool.archived_at);
  const categories = [
    { label: "Todos", value: active.length, icon: Layers3, search: {} },
    {
      label: "Em andamento",
      value: filterPools(all, { group: "ongoing" }).length,
      icon: Users,
      search: { group: "ongoing" },
    },
    {
      label: "Aguardando sorteio",
      value: filterPools(all, { status: "AWAITING_DRAW" }).length,
      icon: Clock,
      tone: "info" as const,
      search: { status: "AWAITING_DRAW" },
    },
    {
      label: "Com resultado",
      value: filterPools(all, { group: "result" }).length,
      icon: Trophy,
      tone: "success" as const,
      search: { group: "result" },
    },
    {
      label: "Finalizados",
      value: filterPools(all, { group: "finished" }).length,
      icon: Flag,
      search: { group: "finished" },
    },
    {
      label: "Arquivados",
      value: filterPools(all, { archived: "yes" }).length,
      icon: Archive,
      search: { archived: "yes" },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bolões"
        description="Escolha uma categoria para encontrar e administrar seus bolões."
        actions={
          <Button asChild className="h-11">
            <Link to="/pools/new">Criar bolão</Link>
          </Button>
        }
      />

      {queryState === "loading" ? (
        <LoadingState rows={3} label="Organizando bolões…" />
      ) : queryState === "error" ? (
        <ErrorState onRetry={() => void pools.refetch()} />
      ) : (
        <nav aria-label="Categorias de bolões" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {categories.map((category) => (
            <StatCard
              key={category.label}
              label={category.label}
              value={category.value}
              icon={category.icon}
              {...(category.tone ? { tone: category.tone } : {})}
              to="/pools/list"
              search={category.search}
            />
          ))}
        </nav>
      )}
    </div>
  );
}