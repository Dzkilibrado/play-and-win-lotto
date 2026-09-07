import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { NumberBall } from "@/components/lottery/NumberBall";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getLotteryConfig } from "@/config/lotteries";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DrawWithNumbers } from "@/lib/services/lotteryDataService";

export function ContestCard({
  draw,
  className,
  compact = false,
}: {
  draw: DrawWithNumbers;
  className?: string | undefined;
  compact?: boolean;
}) {
  const config = getLotteryConfig(draw.lotteries?.slug);
  const numbers = [...(draw.draw_numbers ?? [])].sort((a, b) => a.number - b.number);

  return (
    <Link
      to="/contests/$id"
      params={{ id: draw.id }}
      data-lottery={config?.colorKey}
      aria-label={`Abrir concurso ${draw.contest_number} da ${draw.lotteries?.name ?? "loteria"}`}
      className={cn(
        "tappable block rounded-xl border border-border bg-surface p-4 hover:border-lottery/60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold text-lottery">
            {draw.lotteries?.name ?? "—"}
          </p>
          <p className="text-xs text-text-secondary">
            Concurso {draw.contest_number} · {formatDate(draw.draw_date)}
          </p>
        </div>
        <StatusBadge
          tone={draw.is_accumulated ? "warning" : "success"}
          label={draw.is_accumulated ? "Acumulado" : "Com ganhador"}
        />
      </div>

      {numbers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {numbers.map((item) => (
            <NumberBall key={item.number} value={item.number} variant="lottery" size="sm" />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-text-secondary">Dezenas ainda não importadas.</p>
      )}

      {!compact && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-text-secondary">Prêmio principal</dt>
            <dd className="font-medium text-text-primary">
              {draw.main_prize === null
                ? "—"
                : Number(draw.main_prize) === 0
                  ? "Não houve ganhador"
                  : formatCurrency(draw.main_prize)}
            </dd>
          </div>
          <div>
            <dt className="text-text-secondary">Próximo concurso</dt>
            <dd className="font-medium text-text-primary">
              {draw.next_contest_number ?? "—"} · {formatDate(draw.next_draw_date)}
            </dd>
          </div>
        </dl>
      )}

      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-lottery">
        Ver detalhes <ChevronRight className="size-3.5" aria-hidden />
      </span>
    </Link>
  );
}
