import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Ticket, Trophy, Users } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { getLotteryConfig } from "@/config/lotteries";
import { formatCurrency, formatDate } from "@/lib/format";
import { noQuotaLimitLabel, quotaLabel, quotaProgress, remainingQuotas } from "@/lib/pools/poolMath";
import { cn } from "@/lib/utils";
import { poolStatusLabel, poolStatusTone } from "@/types/domain";
import type { PoolRow } from "@/lib/services/poolService";
import { PoolCountdown } from "./PoolCountdown";

/**
 * Card compacto do bolão. O card inteiro é o link para o detalhe — não há
 * ação concorrente dentro dele.
 */
export function PoolCard({ pool, className }: { pool: PoolRow; className?: string }) {
  const config = getLotteryConfig(pool.lotteries?.slug);
  const active = pool.pool_participants.filter((p) => p.status === "ACTIVE");
  const confirmed = active.filter((p) => p.payment_status === "PAID").length;
  const quotasTaken = active.reduce((sum, p) => sum + p.quotas, 0);
  const livres = remainingQuotas(pool.total_quotas, quotasTaken);

  const pendentes = active.filter(
    (p) => p.payment_status === "PENDING" || p.payment_status === "PARTIAL" || p.payment_status === "OVERDUE",
  ).length;
  const contest = pool.contest_number ?? pool.contest_number_planned;
  const drawDate = pool.draw_date ?? pool.draw_date_planned;
  const planned = pool.draw_date === null && pool.draw_date_planned !== null;

  return (
    <Link
      to="/pools/$id"
      params={{ id: pool.id }}
      data-lottery={config?.colorKey}
      aria-label={`Abrir bolão ${pool.name}`}
      className={cn(
        "tappable block min-w-0 rounded-xl border border-border bg-surface p-4 hover:border-lottery/60",
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-text-primary">{pool.name}</p>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {pool.lotteries?.name ?? "—"}
            {contest ? ` · Concurso ${contest}` : " · Concurso a definir"}
          </p>
        </div>
        <StatusBadge label={poolStatusLabel[pool.status]} tone={poolStatusTone[pool.status]} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
        <span className="inline-flex min-w-0 items-center gap-1">
          <Users className="size-3.5 shrink-0" aria-hidden />
          {confirmed} de {active.length} {active.length === 1 ? "confirmado" : "confirmados"}
        </span>
        <span className="shrink-0">
          {livres === null
            ? `${quotasTaken} ${quotasTaken === 1 ? "cota" : "cotas"}`
            : `${quotaLabel(pool.total_quotas, quotasTaken)} cotas`}
        </span>
        <span className="inline-flex items-center gap-1">
          <Ticket className="size-3.5" aria-hidden />
          {pool.pool_games.length} {pool.pool_games.length === 1 ? "jogo" : "jogos"}
        </span>
      </div>

      {livres === null ? null : (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-secondary"
          role="progressbar"
          aria-valuenow={quotaProgress(pool.total_quotas, quotasTaken)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Cotas preenchidas"
        >
          <div
            className="h-full rounded-full bg-lottery"
            style={{ width: `${quotaProgress(pool.total_quotas, quotasTaken)}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          {drawDate ? `${planned ? "Previsto " : ""}${formatDate(drawDate)}` : "Sorteio a definir"}
        </span>
        <span className="shrink-0">
          {livres === null ? noQuotaLimitLabel : `${livres} livres`} ·{" "}
          {formatCurrency(pool.quota_value)} por cota
        </span>
        {pool.status === "PRIZED" ? (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <Trophy className="size-3.5" aria-hidden />
            Premiado
          </span>
        ) : pendentes > 0 ? (
          <span className="text-warning">{pendentes} com pagamento em aberto</span>
        ) : null}
        <ChevronRight className="ml-auto size-4" aria-hidden />
      </div>

      <PoolCountdown date={drawDate} className="mt-2" />
    </Link>
  );
}
