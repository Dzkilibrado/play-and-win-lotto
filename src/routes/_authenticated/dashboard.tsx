import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, CheckCircle2, Clock, ListChecks, Sparkles, Trophy, Users } from "lucide-react";

import { StatCard } from "@/components/common/Cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContestCard } from "@/components/lottery/ContestCard";
import { Button } from "@/components/ui/button";
import { activeLotteries, type LotterySlug } from "@/config/lotteries";
import { appConfig } from "@/config/app.config";
import { formatCurrency, formatDate } from "@/lib/format";
import { checkService } from "@/lib/services/checkService";
import { gameService } from "@/lib/services/gameService";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: `Início — ${appConfig.name}` },
      { name: "description", content: "Próximos concursos, seus jogos e bolões em um só lugar." },
      { property: "og:title", content: `Início — ${appConfig.name}` },
      { property: "og:description", content: "Próximos concursos, seus jogos e bolões." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [resultsLottery, setResultsLottery] = useState<LotterySlug>(activeLotteries[0]!.slug);

  const latest = useQuery({
    queryKey: ["latest-draws"],
    queryFn: () => lotteryDataService.getLatestDraws(),
  });

  const counts = useQuery({
    queryKey: ["game-status-counts"],
    queryFn: () => gameService.statusCounts(),
  });

  const recent = useQuery({
    queryKey: ["recent-results", resultsLottery],
    queryFn: () => lotteryDataService.listRecentResults(resultsLottery, 2),
  });

  const checkSummary = useQuery({
    queryKey: ["check-summary"],
    queryFn: () => checkService.summary(),
  });

  const byStatus = counts.data?.counts ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Início"
        description="O essencial primeiro: seus jogos, os próximos sorteios e os últimos resultados."
      />

      <section aria-labelledby="shortcuts" className="space-y-3">
        <h2 id="shortcuts" className="sr-only">
          Atalhos
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="h-11">
            <Link to="/generate">
              <Sparkles className="size-4" aria-hidden />
              Criar jogo
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link to="/games/importar">
              <Camera className="size-4" aria-hidden />
              Importar por foto
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-11">
            <Link to="/games">
              <ListChecks className="size-4" aria-hidden />
              Meus jogos
            </Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="my-numbers" className="space-y-3">
        <h2 id="my-numbers" className="font-display text-base font-semibold text-text-primary">
          Seus jogos
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total salvos"
            value={counts.data?.total ?? 0}
            icon={ListChecks}
            to="/games"
          />
          <StatCard
            label="Aguardando sorteio"
            value={byStatus.AWAITING_DRAW ?? 0}
            icon={Clock}
            tone="info"
            to="/games"
            search={{ status: "AWAITING_DRAW" }}
          />
          <StatCard
            label="A conferir"
            value={byStatus.AWAITING_CHECK ?? 0}
            icon={CheckCircle2}
            tone="warning"
            to="/games"
            search={{ status: "AWAITING_CHECK" }}
          />
          <StatCard
            label="Premiados"
            value={byStatus.PRIZED ?? 0}
            icon={Trophy}
            tone="success"
            to="/games"
            search={{ status: "PRIZED" }}
          />
        </div>
        {checkSummary.data && checkSummary.data.checked > 0 ? (
          <p className="text-xs text-text-secondary">
            {checkSummary.data.prized > 0
              ? `Conferência automática: ${checkSummary.data.prized} de ${checkSummary.data.checked} jogos conferidos tiveram premiação, somando ${formatCurrency(checkSummary.data.totalPrize)}${checkSummary.data.amountPending ? " (há faixas com valor ainda não divulgado)" : ""}.`
              : `Conferência automática: ${checkSummary.data.checked} jogos conferidos, nenhum premiado até agora.`}
          </p>
        ) : null}

        <Button asChild variant="ghost" size="sm" className="h-11">
          <Link to="/pools">
            <Users className="size-4" aria-hidden />
            Ver bolões
          </Link>
        </Button>
      </section>

      <section aria-labelledby="next-contests" className="space-y-3">
        <h2 id="next-contests" className="font-display text-base font-semibold text-text-primary">
          Próximos sorteios
        </h2>
        {latest.isLoading ? (
          <LoadingState rows={2} />
        ) : latest.isError ? (
          <ErrorState onRetry={() => latest.refetch()} />
        ) : (
          <ul className="grid gap-2 md:grid-cols-3">
            {activeLotteries.map((lottery) => {
              const draw = (latest.data ?? []).find(
                (item) => item.lotteries?.slug === lottery.slug,
              );
              return (
                <li
                  key={lottery.slug}
                  data-lottery={lottery.colorKey}
                  className="surface-card flex items-center gap-3 p-3"
                >
                  <span className="size-2.5 shrink-0 rounded-full bg-lottery" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-text-primary">
                      {lottery.name}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {draw?.next_contest_number
                        ? `Concurso ${draw.next_contest_number} · ${formatDate(draw.next_draw_date)}`
                        : "Sem data disponível"}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-semibold text-lottery">
                    {formatCurrency(draw?.estimated_next_prize ?? null)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-results" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="recent-results"
            className="font-display text-base font-semibold text-text-primary"
          >
            Últimos resultados
          </h2>
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Modalidade">
            {activeLotteries.map((lottery) => (
              <button
                key={lottery.slug}
                type="button"
                role="tab"
                aria-selected={resultsLottery === lottery.slug}
                onClick={() => setResultsLottery(lottery.slug)}
                data-lottery={lottery.colorKey}
                className={cn(
                  "touch-target rounded-full px-3 text-xs font-medium transition-colors",
                  resultsLottery === lottery.slug
                    ? "bg-lottery text-lottery-foreground"
                    : "bg-surface-secondary text-text-secondary",
                )}
              >
                {lottery.shortName}
              </button>
            ))}
          </div>
        </div>

        {recent.isLoading ? (
          <LoadingState rows={2} />
        ) : recent.isError ? (
          <ErrorState onRetry={() => recent.refetch()} />
        ) : (recent.data ?? []).length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Nenhum resultado disponível"
            description="Nenhum concurso desta modalidade foi importado ainda."
            actions={
              <Button variant="outline" size="sm" onClick={() => recent.refetch()}>
                Atualizar
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(recent.data ?? []).map((draw) => (
              <ContestCard key={draw.id} draw={draw} compact />
            ))}
          </div>
        )}

        <Button asChild variant="outline" size="sm" className="h-11">
          <Link to="/results" search={{ lottery: resultsLottery }}>
            Ver todos os resultados
          </Link>
        </Button>
      </section>
    </div>
  );
}
