import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { MetricCard } from "@/components/common/Cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { DistributionPanel } from "@/components/pool/DistributionPanel";
import { DocumentsPanel } from "@/components/pool/DocumentsPanel";
import { FinancePanel } from "@/components/pool/FinancePanel";
import { GamesPanel } from "@/components/pool/GamesPanel";
import { HistoryPanel } from "@/components/pool/HistoryPanel";
import { ParticipantsPanel } from "@/components/pool/ParticipantsPanel";
import { PaymentDialog } from "@/components/pool/PaymentDialog";
import { PoolActions } from "@/components/pool/PoolActions";
import { PoolCountdown } from "@/components/pool/PoolCountdown";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appConfig } from "@/config/app.config";
import { getLotteryConfig } from "@/config/lotteries";
import { poolNotices } from "@/config/pools.config";
import { useSession } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/format";
import { quotaProgress, remainingQuotas, summarizeFinance } from "@/lib/pools/poolMath";
import { poolService, type PoolParticipantRow } from "@/lib/services/poolService";
import { validateListSearch } from "@/lib/searchFilters";
import { poolStatusLabel, poolStatusTone } from "@/types/domain";

const tabs = [
  { value: "overview", label: "Visão Geral" },
  { value: "participants", label: "Participantes" },
  { value: "games", label: "Jogos" },
  { value: "finance", label: "Financeiro" },
  { value: "result", label: "Resultado" },
  { value: "documents", label: "Documentos" },
  { value: "history", label: "Histórico" },
];

export const Route = createFileRoute("/_authenticated/pools/$id")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Detalhe do bolão — ${appConfig.name}` },
      { name: "description", content: "Participantes, cotas, pagamentos e documentos do bolão." },
      { property: "og:title", content: `Detalhe do bolão — ${appConfig.name}` },
      { property: "og:description", content: "Participantes, cotas, pagamentos e documentos." },
    ],
  }),
  component: PoolDetailPage,
});

function PoolDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = useSession();
  const [payTarget, setPayTarget] = useState<PoolParticipantRow | null>(null);

  const pool = useQuery({ queryKey: ["pool", id], queryFn: () => poolService.get(id) });
  const participants = useQuery({
    queryKey: ["pool", id, "participants"],
    queryFn: () => poolService.participants(id),
  });

  if (pool.isLoading) return <LoadingState rows={4} label="Carregando bolão…" />;
  if (pool.isError) return <ErrorState onRetry={() => void pool.refetch()} />;
  if (!pool.data) {
    return (
      <EmptyState
        title="Bolão não encontrado"
        description="Ele pode ter sido removido ou você não tem acesso."
        actions={
          <Button asChild size="sm">
            <Link to="/pools">Voltar para bolões</Link>
          </Button>
        }
      />
    );
  }

  const data = pool.data;
  const rows = participants.data ?? [];
  const config = getLotteryConfig(data.lotteries?.slug);
  const canManage = user?.id === data.owner_id;
  const contest = data.contest_number ?? data.contest_number_planned;
  const drawDate = data.draw_date ?? data.draw_date_planned;
  const planned = data.draw_date === null && data.draw_date_planned !== null;

  const finance = summarizeFinance(
    rows.map((p) => ({
      quotas: p.quotas,
      amountDue: Number(p.amount_due),
      totalPaid: Number(p.total_paid),
      paymentStatus: p.payment_status,
      cancelled: p.status === "CANCELLED",
    })),
  );

  return (
    <div className="space-y-4" data-lottery={config?.colorKey}>
      <PageHeader
        title={data.name}
        description={`${data.lotteries?.name ?? "—"} · ${contest ? `Concurso ${contest}` : "Concurso a definir"}`}
        actions={
          <>
            <PoolActions pool={data} canManage={canManage} />
            <Button asChild variant="outline" size="sm" className="h-11">
              <Link to="/pools">Voltar</Link>
            </Button>
          </>
        }
      />

      <div className="surface-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={poolStatusLabel[data.status]} tone={poolStatusTone[data.status]} />
          <span className="text-xs text-text-secondary">
            {drawDate ? `${planned ? "Sorteio previsto: " : "Sorteio: "}${formatDate(drawDate)}` : "Sorteio a definir"}
          </span>
          <PoolCountdown date={drawDate} />
        </div>

        {data.status === "CANCELLED" && data.cancel_reason ? (
          <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
            Bolão cancelado: {data.cancel_reason}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Cotas"
            value={`${finance.quotasTaken}/${data.total_quotas}`}
          />
          <MetricCard label="Cotas livres" value={remainingQuotas(data.total_quotas, finance.quotasTaken)} />
          <MetricCard label="Recebido" value={formatCurrency(finance.totalPaid)} />
          <MetricCard label="Em aberto" value={formatCurrency(finance.totalOutstanding)} />
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-secondary"
          role="progressbar"
          aria-valuenow={quotaProgress(data.total_quotas, finance.quotasTaken)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Cotas preenchidas"
        >
          <div
            className="h-full rounded-full bg-lottery"
            style={{ width: `${quotaProgress(data.total_quotas, finance.quotasTaken)}%` }}
          />
        </div>

        {data.is_public ? (
          <p className="text-xs text-text-secondary">{poolNotices.publicLink}</p>
        ) : null}
      </div>

      <Tabs
        value={search.tab ?? "overview"}
        onValueChange={(value) => navigate({ search: (prev) => ({ ...prev, tab: value }) })}
      >
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList className="w-max">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-3">
          <div className="surface-card space-y-2 p-4 text-sm">
            <p className="text-text-secondary">
              Valor da cota: <strong className="text-text-primary">{formatCurrency(data.quota_value)}</strong>
            </p>
            <p className="text-text-secondary">
              Arrecadação prevista:{" "}
              <strong className="text-text-primary">
                {formatCurrency(data.quota_value * data.total_quotas)}
              </strong>
            </p>
            <p className="text-text-secondary">
              Prazo de pagamento:{" "}
              <strong className="text-text-primary">{formatDate(data.payment_deadline)}</strong>
            </p>
            {data.notes ? <p className="text-text-secondary">{data.notes}</p> : null}
          </div>
        </TabsContent>

        <TabsContent value="participants" className="mt-4">
          {participants.isLoading ? (
            <LoadingState rows={3} />
          ) : (
            <ParticipantsPanel
              pool={data}
              participants={rows}
              canManage={canManage}
              onPay={setPayTarget}
            />
          )}
        </TabsContent>

        <TabsContent value="games" className="mt-4">
          <GamesPanel pool={data} canManage={canManage} />
        </TabsContent>

        <TabsContent value="finance" className="mt-4">
          <FinancePanel pool={data} participants={rows} canManage={canManage} />
        </TabsContent>

        <TabsContent value="result" className="mt-4">
          <DistributionPanel pool={data} participants={rows} canManage={canManage} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsPanel poolId={data.id} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryPanel poolId={data.id} />
        </TabsContent>
      </Tabs>

      <PaymentDialog poolId={data.id} participant={payTarget} onClose={() => setPayTarget(null)} />
    </div>
  );
}
