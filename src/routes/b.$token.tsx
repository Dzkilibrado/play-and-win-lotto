import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Timer } from "lucide-react";

import { EmptyState, LoadingState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { NumberBall } from "@/components/lottery/NumberBall";
import { PublicGameList } from "@/components/pool/PublicGameList";
import { PublicParticipantList } from "@/components/pool/PublicParticipantList";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { getLotteryConfig } from "@/config/lotteries";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil, formatCurrency, formatDate } from "@/lib/format";
import { noQuotaLimitLabel, quotaProgress } from "@/lib/pools/poolMath";
import type { PublicPoolSummary } from "@/lib/pools/publicPool";
import { poolStatusLabel, poolStatusTone } from "@/types/domain";

export const Route = createFileRoute("/b/$token")({
  head: () => ({
    meta: [
      { title: `Acompanhar bolão — ${appConfig.name}` },
      {
        name: "description",
        content:
          "Acompanhe um bolão: modalidade, concurso, sorteio, participantes confirmados e jogos apostados.",
      },
      { property: "og:title", content: `Acompanhar bolão — ${appConfig.name}` },
      {
        property: "og:description",
        content: "Situação do bolão, participantes confirmados, cotas pagas e jogos apostados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPoolPage,
});

/** Contagem regressiva discreta, incluindo o período pós-sorteio. */
function countdownText(date: string | null): string | null {
  const days = daysUntil(date);
  if (days === null) return null;
  if (days < 0) return "Sorteio realizado";
  if (days === 0) return "Hoje é o sorteio";
  if (days === 1) return "Falta 1 dia";
  return `Faltam ${days} dias`;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="truncate text-base font-semibold tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

function PublicPoolPage() {
  const { token } = Route.useParams();

  const summary = useQuery({
    queryKey: ["public-pool", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pool_public_summary", { _token: token });
      if (error) throw error;
      return (data ?? null) as unknown as PublicPoolSummary | null;
    },
  });

  if (summary.isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <LoadingState rows={2} />
      </div>
    );
  }

  const pool = summary.data;
  if (!pool) {
    return (
      <div className="mx-auto max-w-2xl p-4">
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
  const semLimite = pool.totalQuotas === null;
  const progress = quotaProgress(pool.totalQuotas, pool.paidQuotas);
  const countdown = countdownText(pool.drawDate);
  const participants = pool.participants ?? [];
  const games = pool.gameList ?? [];
  const result = pool.result ?? null;
  const drawn = result?.drawnNumbers ?? [];

  return (
    <main
      className="mx-auto w-full min-w-0 max-w-2xl space-y-3 overflow-x-hidden p-4"
      data-lottery={config?.colorKey}
    >
      <header className="surface-card space-y-3 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold leading-tight text-text-primary sm:text-xl">
              {pool.name}
            </h1>
            <p className="mt-0.5 truncate text-sm text-text-secondary">
              {pool.lottery}
              {pool.contestNumber ? ` · Concurso ${pool.contestNumber}` : " · Concurso a definir"}
            </p>
          </div>
          <StatusBadge label={poolStatusLabel[pool.status]} tone={poolStatusTone[pool.status]} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
          <span>
            {pool.drawDate
              ? `${pool.drawDatePlanned ? "Sorteio previsto: " : "Sorteio: "}${formatDate(pool.drawDate)}`
              : "Sorteio a definir"}
          </span>
          {countdown ? (
            <span className="inline-flex items-center gap-1">
              <Timer className="size-3.5" aria-hidden />
              {countdown}
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <SummaryItem label="Participantes confirmados" value={String(pool.confirmedParticipants)} />
          <SummaryItem
            label="Cotas pagas"
            value={semLimite ? String(pool.paidQuotas) : `${pool.paidQuotas} de ${pool.totalQuotas}`}
          />
          <SummaryItem
            label={semLimite ? "Limite de cotas" : "Cotas disponíveis"}
            value={semLimite ? noQuotaLimitLabel : String(pool.availableQuotas ?? 0)}
          />
          <SummaryItem label="Jogos" value={String(pool.games)} />
        </dl>

        {semLimite ? null : (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-secondary"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Cotas pagas"
          >
            <div className="h-full rounded-full bg-lottery" style={{ width: `${progress}%` }} />
          </div>
        )}
      </header>

      <Accordion
        type="multiple"
        defaultValue={["participants"]}
        className="surface-card divide-y divide-border px-4"
      >
        <AccordionItem value="participants" className="border-0">
          <AccordionTrigger className="py-3 text-sm font-semibold">
            Participantes confirmados ({participants.length})
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <PublicParticipantList participants={participants} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="games" className="border-0">
          <AccordionTrigger className="py-3 text-sm font-semibold">
            Jogos do bolão ({games.length})
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <PublicGameList games={games} drawnNumbers={drawn} />
          </AccordionContent>
        </AccordionItem>

        {result ? (
          <AccordionItem value="result" className="border-0">
            <AccordionTrigger className="py-3 text-sm font-semibold">
              Resultado do bolão
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-3">
              {drawn.length > 0 ? (
                <div>
                  <p className="text-xs text-text-secondary">
                    Dezenas sorteadas · Concurso {result.contestNumber}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {drawn.map((number) => (
                      <NumberBall key={number} value={number} size="sm" variant="hit" />
                    ))}
                  </div>
                </div>
              ) : null}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <SummaryItem label="Jogos conferidos" value={String(result.checkedGames)} />
                <SummaryItem label="Jogos premiados" value={String(result.prizedGames)} />
                {result.totalPrize !== null ? (
                  <SummaryItem label="Premiação total" value={formatCurrency(result.totalPrize)} />
                ) : null}
              </dl>
            </AccordionContent>
          </AccordionItem>
        ) : null}
      </Accordion>

      <p className="px-1 text-xs text-text-secondary">
        Esta página mostra apenas o acompanhamento geral do bolão e o nome de quem já pagou.
        Telefones, valores individuais, pagamentos e documentos não são exibidos.
      </p>

      <Button asChild variant="outline" className="h-11 w-full">
        <Link to="/">Conhecer o {appConfig.name}</Link>
      </Button>
    </main>
  );
}
