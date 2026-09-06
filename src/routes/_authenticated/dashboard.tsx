import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Clock, Trophy, Users, Wallet } from "lucide-react";

import { StatCard } from "@/components/common/Cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { LotteryCard, type UpcomingContestInfo } from "@/components/lottery/LotteryCard";
import { Button } from "@/components/ui/button";
import { activeLotteries, type LotterySlug } from "@/config/lotteries";
import { appConfig } from "@/config/app.config";
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

  const upcoming = useQuery({
    queryKey: ["upcoming-draws"],
    queryFn: () => lotteryDataService.getUpcomingDraws(),
  });

  const recent = useQuery({
    queryKey: ["recent-results", resultsLottery],
    queryFn: () => lotteryDataService.listRecentResults(resultsLottery, 3),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Início"
        description="Acompanhe os próximos concursos e a situação dos seus jogos."
      />

      <section aria-labelledby="next-contests" className="space-y-3">
        <h2 id="next-contests" className="font-display text-base font-semibold text-text-primary">
          Próximos concursos
        </h2>
        {upcoming.isLoading ? (
          <LoadingState rows={3} />
        ) : upcoming.isError ? (
          <ErrorState onRetry={() => upcoming.refetch()} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeLotteries.map((lottery) => {
              const draw = (upcoming.data ?? []).find(
                (item) => item.lotteries?.slug === lottery.slug,
              );
              const contest: UpcomingContestInfo = draw
                ? {
                    contestNumber: draw.next_contest_number ?? null,
                    drawDate: draw.next_draw_date ?? null,
                    estimatedPrize: draw.estimated_next_prize ?? null,
                    status: "ready",
                  }
                : {
                    contestNumber: null,
                    drawDate: null,
                    estimatedPrize: null,
                    status: "unavailable",
                  };
              return <LotteryCard key={lottery.slug} lottery={lottery} contest={contest} />;
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="my-numbers" className="space-y-3">
        <h2 id="my-numbers" className="font-display text-base font-semibold text-text-primary">
          Seus indicadores
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label="Aguardando sorteio"
            value="0"
            icon={Clock}
            tone="info"
            to="/games"
            search={{ status: "AWAITING_DRAW" }}
          />
          <StatCard
            label="Conferidos"
            value="0"
            icon={CheckCircle2}
            to="/games"
            search={{ status: "CHECKED" }}
          />
          <StatCard
            label="Premiados"
            value="0"
            icon={Trophy}
            tone="success"
            to="/games"
            search={{ status: "PRIZED" }}
          />
          <StatCard
            label="Bolões ativos"
            value="0"
            icon={Users}
            to="/pools"
            search={{ status: "OPEN" }}
          />
          <StatCard
            label="Pagamentos pendentes"
            value="0"
            icon={Wallet}
            tone="warning"
            to="/pools"
            search={{ payment: "PENDING" }}
          />
        </div>
        <p className="text-xs text-text-secondary">
          Os contadores começam em zero: nenhum jogo ou bolão foi registrado ainda.
        </p>
      </section>

      <section aria-labelledby="recent-results" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recent-results" className="font-display text-base font-semibold text-text-primary">
            Resultados recentes
          </h2>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Modalidade">
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
            description="A sincronização com a fonte oficial ainda não foi implementada, então nenhum número é exibido."
            actions={
              <Button variant="outline" size="sm" onClick={() => recent.refetch()}>
                Atualizar
              </Button>
            }
          />
        ) : null}
      </section>
    </div>
  );
}
