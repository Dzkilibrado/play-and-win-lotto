import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { LotteryCard, type UpcomingContestInfo } from "@/components/lottery/LotteryCard";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { useLotteryAvailability } from "@/hooks/useLotteryAvailability";
import { useNextDraws } from "@/hooks/useNextDraws";
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
  const { availabilityOf, noteOf } = useLotteryAvailability();
  const latest = useQuery({
    queryKey: ["latest-draws"],
    queryFn: () => lotteryDataService.getLatestDraws(),
  });

  const nextDraws = useNextDraws((slug) => {
    const draw = (latest.data ?? []).find((item) => item.lotteries?.slug === slug);
    return draw
      ? {
          contestNumber: draw.next_contest_number,
          drawDate: draw.next_draw_date,
          estimatedPrize: draw.estimated_next_prize,
          fetchedAt: null,
        }
      : null;
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

      {latest.isLoading || nextDraws.isLoading ? (
        <LoadingState rows={3} />
      ) : latest.isError ? (
        <ErrorState onRetry={() => latest.refetch()} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeLotteries.map((lottery) => {
            const view = nextDraws.viewOf(lottery.slug);
            const contest: UpcomingContestInfo =
              view.kind === "ready"
                ? {
                    contestNumber: view.contestNumber,
                    drawDate: view.drawDate,
                    estimatedPrize: view.estimatedPrize,
                    status: "ready",
                  }
                : {
                    contestNumber: null,
                    drawDate: null,
                    estimatedPrize: null,
                    status: view.kind === "awaiting" ? "awaiting" : "unavailable",
                  };
            const availability = availabilityOf(lottery.slug);
            const maintenance = availability === "MAINTENANCE";
            const disabled = availability === "DISABLED";
            return (
              <div key={lottery.slug} className="space-y-2">
                <LotteryCard
                  lottery={lottery}
                  contest={contest}
                  informativeLabel={disabled ? "Em breve" : undefined}
                />
                {maintenance ? (
                  <p className="rounded-lg bg-warning-soft p-2 text-xs text-warning" role="status">
                    Em manutenção
                    {noteOf(lottery.slug) ? ` — ${noteOf(lottery.slug)}` : ""}. Novos jogos e bolões
                    estão pausados.
                  </p>
                ) : null}
                {disabled ? (
                  <p className="rounded-lg bg-surface-secondary p-2 text-xs text-text-secondary">
                    Ainda não disponível para jogos e bolões. As informações do próximo sorteio são
                    apenas para consulta.
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
