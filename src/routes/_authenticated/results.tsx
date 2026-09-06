import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
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
      ) : (
        <EmptyState
          icon={Trophy}
          title="Nenhum resultado disponível"
          description="A sincronização com a fonte oficial ainda não foi implementada. Nenhum número fictício é exibido aqui."
        />
      )}
    </div>
  );
}
