import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Ticket, Users } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { getLotteryConfig } from "@/config/lotteries";
import { formatCurrency, formatDate } from "@/lib/format";
import { quotaProgress, remainingQuotas } from "@/lib/pools/poolMath";
import { cn } from "@/lib/utils";
import { poolStatusLabel, poolStatusTone } from "@/types/domain";
import type { PoolRow } from "@/lib/services/poolService";
import { PoolCountdown } from "./PoolCountdown";

export function PoolCard({ pool, className }: { pool: PoolRow; className?: string }) {
  const config = getLotteryConfig(pool.lotteries?.slug);
  const active = pool.pool_participants.filter((p) => p.status === "ACTIVE");
  const quotasTaken = active.reduce((sum, p) => sum + p.quotas, 0);
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
      className={cn(
        "block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-lottery/60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-text-primary">{pool.name}</p>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {pool.lotteries?.name ?? "—"}
            {contest ? ` · Concurso ${contest}` : " · Concurso a definir"}
          </p>
        </div>
        <StatusBadge label={poolStatusLabel[pool.status]} tone={poolStatusTone[pool.status]} />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs text-text-secondary">
          <span className="inline-flex min-w-0 items-center gap-1">
            <Users className="size-3.5 shrink-0" aria-hidden />
            {active.length} {active.length === 1 ? "participante" : "participantes"}
          </span>
          <span className="shrink-0">
            {livres === null
              ? `${quotasTaken} ${quotasTaken === 1 ? "cota" : "cotas"}`
              : `${quotaLabel(pool.total_quotas, quotasTaken)} cotas`}
          </span>
        </div>
        {livres === null ? null : (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-secondary"
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
        <p className="text-xs text-text-secondary">
          {livres === null ? noQuotaLimitLabel : `${livres} cotas livres`} ·{" "}
          {formatCurrency(pool.quota_value)} por cota
        </p>
      </div>


      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          {drawDate ? `${planned ? "Previsto " : ""}${formatDate(drawDate)}` : "Sorteio a definir"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Ticket className="size-3.5" aria-hidden />
          {pool.pool_games.length} {pool.pool_games.length === 1 ? "jogo" : "jogos"}
        </span>
        {pendentes > 0 ? (
          <span className="text-warning">{pendentes} com pagamento em aberto</span>
        ) : null}
        <ChevronRight className="ml-auto size-4" aria-hidden />
      </div>

      <PoolCountdown date={drawDate} className="mt-2" />
    </Link>
  );
}
