import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { EmptyState, LoadingState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { getLotteryConfig } from "@/config/lotteries";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { quotaProgress } from "@/lib/pools/poolMath";
import { poolStatusLabel, poolStatusTone, type PoolStatus } from "@/types/domain";

export const Route = createFileRoute("/b/$token")({
  head: () => ({
    meta: [
      { title: `Acompanhar bolão — ${appConfig.name}` },
      {
        name: "description",
        content: "Acompanhe a situação de um bolão: modalidade, concurso, cotas preenchidas e sorteio.",
      },
      { property: "og:title", content: `Acompanhar bolão — ${appConfig.name}` },
      {
        property: "og:description",
        content: "Situação do bolão, cotas preenchidas e data do sorteio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPoolPage,
});

interface PublicSummary {
  name: string;
  lottery: string;
  lotterySlug: string;
  contestNumber: number | null;
  drawDate: string | null;
  drawDatePlanned: boolean;
  status: PoolStatus;
  totalQuotas: number;
  takenQuotas: number;
  participants: number;
  games: number;
  quotaValue: number;
}

function PublicPoolPage() {
  const { token } = Route.useParams();

  const summary = useQuery({
    queryKey: ["public-pool", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pool_public_summary", { _token: token });
      if (error) throw error;
      return (data ?? null) as unknown as PublicSummary | null;
    },
  });

  if (summary.isLoading) return <div className="mx-auto max-w-lg p-4"><LoadingState rows={2} /></div>;

  const pool = summary.data;
  if (!pool) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <EmptyState
          title="Este link não está mais disponível"
          description="O organizador pode ter desativado o compartilhamento deste bolão."
          actions={
            <Button asChild size="sm">
              <Link to="/">Ir para o início</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const config = getLotteryConfig(pool.lotterySlug);
  const progress = quotaProgress(pool.totalQuotas, pool.takenQuotas);

  return (
    <main className="mx-auto max-w-lg space-y-4 p-4" data-lottery={config?.colorKey}>
      <div className="surface-card space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-text-primary">{pool.name}</h1>
            <p className="text-sm text-text-secondary">
              {pool.lottery}
              {pool.contestNumber ? ` · Concurso ${pool.contestNumber}` : " · Concurso a definir"}
            </p>
          </div>
          <StatusBadge label={poolStatusLabel[pool.status]} tone={poolStatusTone[pool.status]} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              {pool.takenQuotas}/{pool.totalQuotas} cotas preenchidas
            </span>
            <span>{formatCurrency(pool.quotaValue)} por cota</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-secondary"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Cotas preenchidas"
          >
            <div className="h-full rounded-full bg-lottery" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-text-secondary">Participantes</dt>
            <dd className="font-medium text-text-primary">{pool.participants}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Jogos</dt>
            <dd className="font-medium text-text-primary">{pool.games}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-text-secondary">Sorteio</dt>
            <dd className="font-medium text-text-primary">
              {pool.drawDate
                ? `${pool.drawDatePlanned ? "Previsto para " : ""}${formatDate(pool.drawDate)}`
                : "A definir"}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-text-secondary">
          Esta página mostra apenas a situação geral do bolão. Nomes, telefones e valores individuais
          dos participantes não são exibidos.
        </p>
      </div>

      <Button asChild variant="outline" className="h-11 w-full">
        <Link to="/">Conhecer o {appConfig.name}</Link>
      </Button>
    </main>
  );
}
