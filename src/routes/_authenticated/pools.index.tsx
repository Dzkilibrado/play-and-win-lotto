import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Clock, Flag, Layers3, Trophy, Users } from "lucide-react";

import { StatCard } from "@/components/common/Cards";
import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
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
  const counts = useQuery({ queryKey: ["pool-hub-counts", user.id], queryFn: () => poolService.hubCounts() });
  const queryState = resolveQueryState(counts);
  const values = counts.data ?? { all: 0, ongoing: 0, awaiting_draw: 0, result: 0, finished: 0, archived: 0 };
  const categories = [
    { label: "Todos", value: values.all, icon: Layers3, search: {} },
    {
      label: "Em andamento",
      value: values.ongoing,
      icon: Users,
      search: { group: "ongoing" },
    },
    {
      label: "Aguardando sorteio",
      value: values.awaiting_draw,
      icon: Clock,
      tone: "info" as const,
      search: { status: "AWAITING_DRAW" },
    },
    {
      label: "Com resultado",
      value: values.result,
      icon: Trophy,
      tone: "success" as const,
      search: { group: "result" },
    },
    {
      label: "Finalizados",
      value: values.finished,
      icon: Flag,
      search: { group: "finished" },
    },
    {
      label: "Arquivados",
      value: values.archived,
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
        <ErrorState onRetry={() => void counts.refetch()} />
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