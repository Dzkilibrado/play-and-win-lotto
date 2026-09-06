import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { NumberBall } from "@/components/lottery/NumberBall";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { syncConfig } from "@/config/sync.config";
import { getLotteryConfig } from "@/config/lotteries";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { lotteryDataService } from "@/lib/services/lotteryDataService";

export const Route = createFileRoute("/_authenticated/contests/$id")({
  head: () => ({
    meta: [
      { title: `Detalhe do concurso — ${appConfig.name}` },
      { name: "description", content: "Dezenas sorteadas, rateio e premiação do concurso." },
      { property: "og:title", content: `Detalhe do concurso — ${appConfig.name}` },
      { property: "og:description", content: "Dezenas sorteadas, rateio e premiação." },
    ],
  }),
  component: ContestDetailPage,
});

function ContestDetailPage() {
  const { id } = Route.useParams();
  const contest = useQuery({
    queryKey: ["contest", id],
    queryFn: () => lotteryDataService.getContestById(id),
  });

  const draw = contest.data;
  const config = getLotteryConfig(draw?.lotteries?.slug);
  const numbers = [...(draw?.draw_numbers ?? [])].sort((a, b) => a.position - b.position);
  const ascending = [...numbers].sort((a, b) => a.number - b.number);
  const prizes = [...(draw?.draw_prizes ?? [])].sort((a, b) => b.hits - a.hits);

  return (
    <div className="space-y-4" data-lottery={config?.colorKey}>
      <PageHeader
        title={draw ? `${draw.lotteries?.name} · Concurso ${draw.contest_number}` : "Concurso"}
        description={draw ? formatDate(draw.draw_date) : ""}
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/contests">Voltar</Link>
          </Button>
        }
      />

      {contest.isLoading ? (
        <LoadingState rows={3} />
      ) : contest.isError ? (
        <ErrorState onRetry={() => contest.refetch()} />
      ) : !draw ? (
        <EmptyState
          title="Concurso não encontrado"
          description="Este concurso ainda não foi importado para o nosso banco."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/contests">Ver todos os concursos</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Dezenas sorteadas
              </h2>
              <StatusBadge
                tone={draw.is_accumulated ? "warning" : "success"}
                label={draw.is_accumulated ? "Acumulado" : "Com ganhador"}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ascending.map((item) => (
                <NumberBall key={item.number} value={item.number} variant="lottery" />
              ))}
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              Ordem de sorteio: {numbers.map((item) => String(item.number).padStart(2, "0")).join(" · ")}
            </p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Info label="Local do sorteio" value={draw.draw_location ?? "—"} />
            <Info label="Prêmio principal" value={formatCurrency(draw.main_prize)} />
            <Info label="Arrecadação" value={formatCurrency(draw.revenue)} />
            <Info
              label="Próximo concurso"
              value={
                draw.next_contest_number
                  ? `${draw.next_contest_number} · ${formatDate(draw.next_draw_date)}`
                  : "—"
              }
            />
            <Info
              label="Estimativa do próximo prêmio"
              value={formatCurrency(draw.estimated_next_prize)}
            />
            <Info
              label="Fonte / última atualização"
              value={`${syncConfig.sourceLabel} · ${formatDate(draw.source_updated_at?.slice(0, 10) ?? null)}`}
            />
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-display text-sm font-semibold text-text-primary">
              Premiação por faixa
            </h2>
            {prizes.length === 0 ? (
              <p className="mt-2 text-xs text-text-secondary">
                A fonte oficial não informou o rateio deste concurso.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {prizes.map((prize) => (
                  <div
                    key={prize.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-text-primary">{prize.tier}</span>
                    <span className="text-xs text-text-secondary">
                      {formatNumber(prize.winners)} ganhador(es)
                    </span>
                    <span className="font-medium text-text-primary">
                      {formatCurrency(prize.prize_per_winner)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}
