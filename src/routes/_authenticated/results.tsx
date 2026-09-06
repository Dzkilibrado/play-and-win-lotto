import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContestCard } from "@/components/lottery/ContestCard";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { validateListSearch } from "@/lib/searchFilters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/results")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Resultados — ${appConfig.name}` },
      { name: "description", content: "Resultados dos concursos por modalidade." },
      { property: "og:title", content: `Resultados — ${appConfig.name}` },
      { property: "og:description", content: "Resultados dos concursos por modalidade." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const slug = search.lottery ?? activeLotteries[0]!.slug;

  const results = useQuery({
    queryKey: ["results", slug],
    queryFn: () => lotteryDataService.listRecentResults(slug, 10),
  });

  const rows = results.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Resultados"
        description="Consulta feita sempre no nosso banco, nunca direto na fonte externa."
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Modalidade">
        {activeLotteries.map((item) => (
          <button
            key={item.slug}
            type="button"
            role="tab"
            aria-selected={item.slug === slug}
            data-lottery={item.colorKey}
            onClick={() => navigate({ search: (prev) => ({ ...prev, lottery: item.slug }) })}
            className={cn(
              "touch-target rounded-full px-4 text-sm font-medium transition-colors",
              item.slug === slug
                ? "bg-lottery text-lottery-foreground"
                : "bg-surface-secondary text-text-secondary",
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      {results.isLoading ? (
        <LoadingState rows={3} />
      ) : results.isError ? (
        <ErrorState onRetry={() => results.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nenhum resultado disponível"
          description="Nenhum concurso desta modalidade foi importado ainda. Nenhum número fictício é exibido aqui."
        />
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            {rows.length} resultado{rows.length > 1 ? "s" : ""} mais recente
            {rows.length > 1 ? "s" : ""}
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((draw) => (
              <ContestCard key={draw.id} draw={draw} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
