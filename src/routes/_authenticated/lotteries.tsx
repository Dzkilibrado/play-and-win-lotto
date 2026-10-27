import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { LotteryCard, type UpcomingContestInfo } from "@/components/lottery/LotteryCard";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { useLotteryAvailability } from "@/hooks/useLotteryAvailability";
import { lotteryDataService } from "@/lib/services/lotteryDataService";

export const Route = createFileRoute("/_authenticated/lotteries")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { visibleLotteries, availabilityOf, noteOf } = useLotteryAvailability();
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
          {visibleLotteries.map((lottery) => {
            const draw = (latest.data ?? []).find((item) => item.lotteries?.slug === lottery.slug);
            const contest: UpcomingContestInfo = {
              contestNumber: draw?.next_contest_number ?? null,
              drawDate: draw?.next_draw_date ?? null,
              estimatedPrize: draw?.estimated_next_prize ?? null,
              status: draw?.next_contest_number ? "ready" : "unavailable",
            };
            const maintenance = availabilityOf(lottery.slug) === "MAINTENANCE";
            return (
              <div key={lottery.slug} className="space-y-2">
                <LotteryCard lottery={lottery} contest={contest} />
                {maintenance ? (
                  <p className="rounded-lg bg-warning-soft p-2 text-xs text-warning" role="status">
                    Em manutenção
                    {noteOf(lottery.slug) ? ` — ${noteOf(lottery.slug)}` : ""}. Novos jogos e bolões
                    estão pausados.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
