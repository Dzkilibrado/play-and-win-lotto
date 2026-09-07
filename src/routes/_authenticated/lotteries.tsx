import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { LotteryCard, type UpcomingContestInfo } from "@/components/lottery/LotteryCard";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { lotteryDataService } from "@/lib/services/lotteryDataService";

export const Route = createFileRoute("/_authenticated/lotteries")({
  head: () => ({
    meta: [
      { title: `Loterias — ${appConfig.name}` },
      {
        name: "description",
        content: "Todas as modalidades disponíveis, com próximo concurso e atalhos.",
      },
      { property: "og:title", content: `Loterias — ${appConfig.name}` },
      { property: "og:description", content: "Todas as modalidades disponíveis no aplicativo." },
    ],
  }),
  component: LotteriesPage,
});

function LotteriesPage() {
  const latest = useQuery({
    queryKey: ["latest-draws"],
    queryFn: () => lotteryDataService.getLatestDraws(),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Loterias"
        description="Todas as modalidades do aplicativo, independentemente das que você acompanha na tela inicial."
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/settings">Personalizar tela inicial</Link>
          </Button>
        }
      />

      {latest.isLoading ? (
        <LoadingState rows={3} />
      ) : latest.isError ? (
        <ErrorState onRetry={() => latest.refetch()} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeLotteries.map((lottery) => {
            const draw = (latest.data ?? []).find((item) => item.lotteries?.slug === lottery.slug);
            const contest: UpcomingContestInfo = {
              contestNumber: draw?.next_contest_number ?? null,
              drawDate: draw?.next_draw_date ?? null,
              estimatedPrize: draw?.estimated_next_prize ?? null,
              status: draw?.next_contest_number ? "ready" : "unavailable",
            };
            return <LotteryCard key={lottery.slug} lottery={lottery} contest={contest} />;
          })}
        </div>
      )}
    </div>
  );
}
