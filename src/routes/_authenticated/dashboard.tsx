import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Clock,
  ListChecks,
  Settings2,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

import { StatCard } from "@/components/common/Cards";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { ContestCard } from "@/components/lottery/ContestCard";
import { Button } from "@/components/ui/button";
import { getLotteryConfig, type LotterySlug } from "@/config/lotteries";
import { appConfig } from "@/config/app.config";
import type { HomeBlockKey } from "@/config/home.config";
import { useHomePreferences } from "@/hooks/useHomePreferences";
import { formatCurrency, formatDate } from "@/lib/format";
import { checkService } from "@/lib/services/checkService";
import { gameService } from "@/lib/services/gameService";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { poolService } from "@/lib/services/poolService";
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

const finishedPoolStatuses = new Set(["FINISHED", "CANCELLED"]);

function DashboardPage() {
  const prefs = useHomePreferences();
  const followedSlugs = prefs.followedSlugs;
  const [resultsLottery, setResultsLottery] = useState<LotterySlug | null>(null);

  // Mantém a aba de resultados válida quando as preferências mudam.
  useEffect(() => {
    if (followedSlugs.length === 0) {
      setResultsLottery(null);
      return;
    }
    setResultsLottery((current) =>
      current && followedSlugs.includes(current) ? current : followedSlugs[0]!,
    );
  }, [followedSlugs]);

  const enabled = new Set(prefs.enabledBlocks);
  const showsLotteryBlocks = followedSlugs.length > 0;

  const counts = useQuery({
    queryKey: ["game-status-counts"],
    queryFn: () => gameService.statusCounts(),
  });

  const checkSummary = useQuery({
    queryKey: ["check-summary"],
    queryFn: () => checkService.summary(),
  });

  const latest = useQuery({
    queryKey: ["latest-draws"],
    queryFn: () => lotteryDataService.getLatestDraws(),
    enabled: showsLotteryBlocks && enabled.has("next_draws"),
  });

  const recent = useQuery({
    queryKey: ["recent-results", resultsLottery],
    queryFn: () => lotteryDataService.listRecentResults(resultsLottery, 2),
    enabled: Boolean(resultsLottery) && enabled.has("recent_results"),
  });

  const pools = useQuery({
    queryKey: ["pools", "home-summary"],
    queryFn: () => poolService.list(),
    enabled: enabled.has("pools"),
  });

  const byStatus = counts.data?.counts ?? {};
  const awaitingCheck = byStatus.AWAITING_CHECK ?? 0;
  const prized = byStatus.PRIZED ?? 0;

  const poolRows = pools.data ?? [];
  const activePools = poolRows.filter((pool) => !finishedPoolStatuses.has(pool.status));
  const pendingPayments = activePools.reduce(
    (total, pool) =>
      total +
      pool.pool_participants.filter(
        (participant) =>
          participant.status === "ACTIVE" &&
          (participant.payment_status === "PENDING" ||
            participant.payment_status === "PARTIAL" ||
            participant.payment_status === "OVERDUE"),
      ).length,
    0,
  );
  const nextPoolDraw = activePools
    .map((pool) => pool.draw_date ?? pool.draw_date_planned)
    .filter((date): date is string => Boolean(date))
    .sort()[0];

  const renderBlock = (key: HomeBlockKey) => {
    switch (key) {
      case "indicators":
        return (
          <section key={key} aria-labelledby="my-numbers" className="space-y-3">
            <h2 id="my-numbers" className="font-display text-base font-semibold text-text-primary">
              Seus jogos
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total salvos" value={counts.data?.total ?? 0} icon={ListChecks} to="/games" />
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
                value={awaitingCheck}
                icon={CheckCircle2}
                tone="warning"
                to="/games"
                search={{ status: "AWAITING_CHECK" }}
              />
              <StatCard
                label="Premiados"
                value={prized}
                icon={Trophy}
                tone="success"
                to="/games"
                search={{ status: "PRIZED" }}
              />
            </div>
            <p className="text-xs text-text-secondary">
              Os indicadores consideram todos os seus jogos, de todas as modalidades.
            </p>
          </section>
        );

      case "pools":
        return (
          <section key={key} aria-labelledby="home-pools" className="space-y-3">
            <h2 id="home-pools" className="font-display text-base font-semibold text-text-primary">
              Meus bolões
            </h2>
            {pools.isLoading ? (
              <LoadingState rows={1} />
            ) : pools.isError ? (
              <ErrorState onRetry={() => pools.refetch()} />
            ) : activePools.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum bolão ativo"
                description="Crie um bolão para dividir cotas e acompanhar pagamentos."
                actions={
                  <Button asChild size="sm" className="h-11">
                    <Link to="/pools/new">Criar bolão</Link>
                  </Button>
                }
              />
            ) : (
              <div className="surface-card space-y-3 p-4">
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-xs text-text-secondary">Ativos</dt>
                    <dd className="font-display text-lg font-semibold text-text-primary">
                      {activePools.length}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-text-secondary">Próximo sorteio</dt>
                    <dd className="font-display text-lg font-semibold text-text-primary">
                      {nextPoolDraw ? formatDate(nextPoolDraw) : "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-text-secondary">Pagamentos pendentes</dt>
                    <dd
                      className={cn(
                        "font-display text-lg font-semibold",
                        pendingPayments > 0 ? "text-warning" : "text-text-primary",
                      )}
                    >
                      {pendingPayments}
                    </dd>
                  </div>
                </dl>
                <Button asChild variant="outline" size="sm" className="h-11">
                  <Link to="/pools">Ver meus bolões</Link>
                </Button>
              </div>
            )}
          </section>
        );

      case "next_draws":
        if (!showsLotteryBlocks) return null;
        return (
          <section key={key} aria-labelledby="next-contests" className="space-y-3">
            <h2 id="next-contests" className="font-display text-base font-semibold text-text-primary">
              Próximos sorteios
            </h2>
            {latest.isLoading ? (
              <LoadingState rows={2} />
            ) : latest.isError ? (
              <ErrorState onRetry={() => latest.refetch()} />
            ) : (
              <ul className="grid gap-2 md:grid-cols-3">
                {prefs.followedLotteries.map((lottery) => {
                  const draw = (latest.data ?? []).find(
                    (item) => item.lotteries?.slug === lottery.slug,
                  );
                  return (
                    <li
                      key={lottery.slug}
                      data-lottery={lottery.config.colorKey}
                      className={cn(
                        "surface-card flex items-center gap-3 p-3",
                        lottery.id === prefs.favoriteId && "ring-1 ring-lottery",
                      )}
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
        );

      case "recent_results":
        if (!showsLotteryBlocks || !resultsLottery) return null;
        return (
          <section key={key} aria-labelledby="recent-results" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2
                id="recent-results"
                className="font-display text-base font-semibold text-text-primary"
              >
                Últimos resultados
              </h2>
              <div
                className="flex flex-wrap items-center gap-1"
                role="tablist"
                aria-label="Modalidade"
              >
                {prefs.followedLotteries.map((lottery) => (
                  <button
                    key={lottery.slug}
                    type="button"
                    role="tab"
                    aria-selected={resultsLottery === lottery.slug}
                    onClick={() => setResultsLottery(lottery.slug)}
                    data-lottery={lottery.config.colorKey}
                    className={cn(
                      "touch-target rounded-full px-3 text-xs font-medium transition-colors",
                      resultsLottery === lottery.slug
                        ? "bg-lottery text-lottery-foreground"
                        : "bg-surface-secondary text-text-secondary",
                    )}
                  >
                    {lottery.config.shortName}
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
        );

      case "awaiting_check":
        return (
          <section key={key} className="space-y-3">
            <h2 className="font-display text-base font-semibold text-text-primary">
              Aguardando conferência
            </h2>
            <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="min-w-0 text-sm text-text-secondary">
                {awaitingCheck > 0
                  ? `${awaitingCheck} jogo(s) serão conferidos assim que o resultado oficial for registrado.`
                  : "Nenhum jogo aguardando conferência."}
              </p>
              <Button asChild variant="outline" size="sm" className="h-11">
                <Link to="/games" search={{ status: "AWAITING_CHECK" }}>
                  Ver jogos
                </Link>
              </Button>
            </div>
          </section>
        );

      case "prized":
        return (
          <section key={key} className="space-y-3">
            <h2 className="font-display text-base font-semibold text-text-primary">Premiados</h2>
            <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="min-w-0 text-sm text-text-secondary">
                {checkSummary.data && checkSummary.data.prized > 0
                  ? `${checkSummary.data.prized} jogo(s) premiados, somando ${formatCurrency(checkSummary.data.totalPrize)}${checkSummary.data.amountPending ? " (há faixas com valor ainda não divulgado)" : ""}.`
                  : "Nenhum jogo premiado até agora."}
              </p>
              <Button asChild variant="outline" size="sm" className="h-11">
                <Link to="/games" search={{ status: "PRIZED" }}>
                  Ver premiados
                </Link>
              </Button>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Início"
        description="O essencial primeiro: seus jogos, os próximos sorteios e os últimos resultados."
        actions={
          <Button asChild variant="ghost" size="sm" className="h-11">
            <Link to="/settings">
              <Settings2 className="size-4" aria-hidden />
              Personalizar
            </Link>
          </Button>
        }
      />

      <section aria-labelledby="shortcuts" className="space-y-3">
        <h2 id="shortcuts" className="sr-only">
          Atalhos
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Shortcut to="/generate" icon={Sparkles} label="Criar jogo" primary />
          <Shortcut to="/games/importar" icon={Camera} label="Importar por foto" />
          <Shortcut to="/games" icon={ListChecks} label="Meus jogos" />
          <Shortcut to="/pools" icon={Users} label="Meus bolões" />
        </div>
      </section>

      {/* Alertas pessoais não dependem de preferência visual. */}
      {prized > 0 || awaitingCheck > 0 ? (
        <p className="rounded-lg bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
          {prized > 0 ? `Você tem ${prized} jogo(s) premiado(s). ` : ""}
          {awaitingCheck > 0 ? `${awaitingCheck} jogo(s) aguardando conferência.` : ""}
        </p>
      ) : null}

      {prefs.loading ? <LoadingState rows={2} /> : prefs.enabledBlocks.map(renderBlock)}

      {!prefs.loading && prefs.enabledBlocks.length === 0 ? (
        <EmptyState
          icon={Settings2}
          title="Tela inicial sem blocos"
          description="Você desativou todos os blocos. Escolha o que quer acompanhar em Configurações."
          actions={
            <Button asChild size="sm" className="h-11">
              <Link to="/settings">Personalizar tela inicial</Link>
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

/** Atalho principal: mesmo peso visual para as quatro ações. */
function Shortcut({
  to,
  icon: Icon,
  label,
  primary = false,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "surface-card flex min-h-[5.5rem] min-w-0 flex-col justify-between gap-2 p-3 transition-colors hover:bg-surface-secondary focus-visible:bg-surface-secondary",
        primary && "border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          primary ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-text-secondary",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="break-words text-sm font-semibold text-text-primary">{label}</span>
    </Link>
  );
}
