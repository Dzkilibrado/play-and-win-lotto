import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, FileText, Timer } from "lucide-react";
import { useState } from "react";

import { SectionTitleWithCount } from "@/components/common/CountBadge";
import { EmptyState, LoadingState } from "@/components/common/StateViews";
import { DocumentViewer, type ViewableDocument } from "@/components/common/DocumentViewer";
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
import { getPublicPoolDocuments } from "@/lib/pools/publicPoolDocuments.functions";
import { useServerFn } from "@tanstack/react-start";
import { poolStatusLabel, poolStatusTone } from "@/types/domain";

export const Route = createFileRoute("/b/$token")({
  head: ({ params }) => {
    const canonicalUrl = `${appConfig.canonicalOrigin}/b/${encodeURIComponent(params.token)}`;
    return {
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
      { property: "og:url", content: canonicalUrl },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  }},
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
  const [viewing, setViewing] = useState<(ViewableDocument & { id: string }) | null>(null);

  const summary = useQuery({
    queryKey: ["public-pool", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pool_public_summary", { _token: token });
      if (error) throw error;
      return (data ?? null) as unknown as PublicPoolSummary | null;
    },
  });
  const publicDocuments = useServerFn(getPublicPoolDocuments);
  const documents = useQuery({ queryKey: ["public-pool-documents", token], queryFn: () => publicDocuments({ data: { token } }) });

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
  const showParticipants = pool.scope === "PARTICIPANTS" || pool.scope === "FULL";
  const showGames = pool.scope === "GAMES" || pool.scope === "FULL";
  const totalQuotas = pool.totalQuotas ?? null;
  const paidQuotas = pool.paidQuotas ?? 0;
  const semLimite = totalQuotas === null;
  const progress = quotaProgress(totalQuotas, paidQuotas);
  const countdown = countdownText(pool.drawDate);
  const participants = pool.participants ?? [];
  const games = pool.gameList ?? [];
  const result = pool.result ?? null;
  const drawn = result?.drawnNumbers ?? [];
  const viewLabel = pool.scope === "PARTICIPANTS"
    ? "Visão de participantes"
    : pool.scope === "GAMES"
      ? "Visão dos jogos"
      : "Acompanhamento completo";

  return (
    <main
      className="mx-auto w-full min-w-0 max-w-2xl space-y-3 overflow-x-hidden p-4"
      data-lottery={config?.colorKey}
    >
      <header className="surface-card space-y-3 p-4">
        <p className="text-xs font-semibold uppercase text-lottery">Bolão · {viewLabel}</p>
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

        {showParticipants ? <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <SummaryItem label="Participantes confirmados" value={String(pool.confirmedParticipants)} />
          <SummaryItem
            label="Cotas pagas"
            value={semLimite ? String(paidQuotas) : `${paidQuotas} de ${totalQuotas}`}
          />
          <SummaryItem
            label={semLimite ? "Limite de cotas" : "Cotas disponíveis"}
            value={semLimite ? noQuotaLimitLabel : String(pool.availableQuotas ?? 0)}
          />
          {showGames ? <SummaryItem label="Jogos" value={String(pool.linkedGames ?? 0)} /> : null}
          {showGames ? <SummaryItem label={(pool.linkedGames ?? 0) === (pool.confirmedBets ?? 0) ? "Situação dos jogos" : "Jogos apostados"} value={(pool.linkedGames ?? 0) === (pool.confirmedBets ?? 0) && (pool.linkedGames ?? 0) > 0 ? "Todos apostados" : String(pool.confirmedBets ?? 0)} /> : null}
        </dl> : showGames ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <SummaryItem label="Jogos" value={String(pool.linkedGames ?? 0)} />
            <SummaryItem label={(pool.linkedGames ?? 0) === (pool.confirmedBets ?? 0) ? "Situação dos jogos" : "Jogos apostados"} value={(pool.linkedGames ?? 0) === (pool.confirmedBets ?? 0) && (pool.linkedGames ?? 0) > 0 ? "Todos apostados" : String(pool.confirmedBets ?? 0)} />
          </dl>
        ) : null}

        {!showParticipants || semLimite ? null : (
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

      <p className="px-1 text-xs font-semibold uppercase text-text-secondary">Resumo</p>
      <Accordion
        type="multiple"
        defaultValue={[showParticipants ? "participants" : "games"]}
        className="surface-card divide-y divide-border px-4"
      >
        {showParticipants ? <AccordionItem value="participants" className="border-0">
          <AccordionTrigger className="gap-3 py-3 text-sm font-semibold">
            <SectionTitleWithCount title="Participantes confirmados" count={participants.length} />
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <PublicParticipantList participants={participants} />
          </AccordionContent>
        </AccordionItem> : null}

        {showGames ? <AccordionItem value="games" className="border-0">
          <AccordionTrigger className="gap-3 py-3 text-sm font-semibold">
             <SectionTitleWithCount title="Jogos do bolão" count={games.length} />
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <PublicGameList
              games={games}
              drawnNumbers={drawn}
              linkedGames={pool.linkedGames ?? 0}
              confirmedBets={pool.confirmedBets ?? 0}
            />
          </AccordionContent>
        </AccordionItem> : null}

        {showGames && result ? (
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
        {showGames && (documents.data?.length ?? 0) > 0 ? <AccordionItem value="documents" className="border-0"><AccordionTrigger className="gap-3 py-3 text-sm font-semibold"><SectionTitleWithCount title="Comprovantes" count={documents.data?.length ?? 0} /></AccordionTrigger><AccordionContent className="pb-3"><ul className="space-y-2">{documents.data?.map((document) => <li key={document.id}><button type="button" className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-lg bg-surface-secondary p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setViewing({ id: document.id, title: document.title, description: document.description, fileName: document.title, mimeType: document.mime_type, fileSize: document.file_size, getUrl: async () => document.url })} aria-label={`Visualizar ${document.title}`}><span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-lottery" aria-hidden /><span className="min-w-0"><span className="block truncate text-sm font-medium text-text-primary">{document.title}</span>{document.description ? <span className="block text-xs text-text-secondary">{document.description}</span> : null}</span></span><span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"><Eye className="size-4" aria-hidden />Visualizar</span></button></li>)}</ul></AccordionContent></AccordionItem> : null}
      </Accordion>
      <DocumentViewer open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }} document={viewing} />

      <p className="px-1 text-xs text-text-secondary">Por privacidade, apenas informações essenciais são exibidas.</p>

      <Button asChild variant="ghost" className="h-11 w-full text-text-secondary">
        <Link to="/">Conhecer o {appConfig.name}</Link>
      </Button>
    </main>
  );
}
