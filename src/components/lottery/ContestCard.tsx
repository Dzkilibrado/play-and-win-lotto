import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { NumberBall } from "@/components/lottery/NumberBall";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getLotteryConfig } from "@/config/lotteries";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ContestSummary } from "@/lib/contests/contestSearch";

/** Card compacto e inteiramente clicável de um concurso oficial. */
export function ContestCard({
  contest,
  className,
  compact = false,
}: {
  contest: ContestSummary;
  className?: string | undefined;
  compact?: boolean;
}) {
  const config = getLotteryConfig(contest.lotterySlug ?? undefined);
  const drawn = contest.numbers.length > 0;

  return (
    <Link
      to="/contests/$id"
      params={{ id: contest.id }}
      data-lottery={config?.colorKey}
      aria-label={`Abrir concurso ${contest.contestNumber} da ${contest.lotteryName ?? "loteria"}`}
      className={cn(
        "tappable block rounded-xl border border-border bg-surface p-4 hover:border-lottery/60",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-lottery">
            {contest.lotteryName ?? "—"}
          </p>
          <p className="text-xs text-text-secondary">
            Concurso {contest.contestNumber} · {formatDate(contest.drawDate)}
          </p>
        </div>
        <StatusBadge
          tone={!drawn ? "neutral" : contest.isAccumulated ? "warning" : "success"}
          label={!drawn ? "Previsto" : contest.isAccumulated ? "Acumulou" : "Com ganhador"}
        />
      </div>

      {drawn ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {contest.numbers.map((value) => (
            <NumberBall key={value} value={value} variant="lottery" size="sm" />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-text-secondary">Dezenas ainda não divulgadas.</p>
      )}

      {!compact && (
        <p className="mt-3 text-xs text-text-secondary">
          Prêmio principal:{" "}
          <span className="font-medium text-text-primary">
            {contest.mainPrize === null
              ? "—"
              : contest.mainPrize === 0
                ? "Não houve ganhador"
                : formatCurrency(contest.mainPrize)}
          </span>
        </p>
      )}

      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-lottery">
        Ver detalhes <ChevronRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
