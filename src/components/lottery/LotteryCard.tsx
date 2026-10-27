import { Link } from "@tanstack/react-router";
import { CalendarDays, Sparkles, Trophy } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import type { LotteryConfig } from "@/config/lotteries";
import { formatCurrency, formatDate } from "@/lib/format";

export interface UpcomingContestInfo {
  contestNumber: number | null;
  drawDate: string | null;
  estimatedPrize: number | null;
  status: "unavailable" | "loading" | "ready" | "awaiting";
}

/** Cartão da modalidade com o próximo concurso. */
export function LotteryCard({
  lottery,
  contest,
  informativeLabel,
}: {
  lottery: LotteryConfig;
  contest: UpcomingContestInfo;
  /** Modalidade indisponível para jogar: só informa o próximo sorteio (com o motivo no selo). */
  informativeLabel?: string | undefined;
}) {
  const unavailable = contest.status !== "ready";
  const awaiting = contest.status === "awaiting";

  return (
    <article data-lottery={lottery.colorKey} className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-lottery-soft px-4 py-3">
        <span className="size-2.5 rounded-full bg-lottery" aria-hidden />
        <h3 className="font-display text-base font-semibold text-text-primary">{lottery.name}</h3>
        <span className="ml-auto">
          {informativeLabel ? (
            <StatusBadge label={informativeLabel} tone="neutral" />
          ) : unavailable ? (
            <StatusBadge label={awaiting ? "Aguardando" : "Sem dados"} tone="neutral" />
          ) : (
            <StatusBadge label="Próximo sorteio" tone="info" />
          )}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-secondary">Concurso</dt>
            <dd className="font-display font-semibold text-text-primary">
              {awaiting ? "—" : (contest.contestNumber ?? "—")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Data</dt>
            <dd className="font-display font-semibold text-text-primary">
              {awaiting ? "—" : formatDate(contest.drawDate)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-text-secondary">Estimativa de prêmio</dt>
            <dd className="font-display text-lg font-semibold text-lottery">
              {awaiting ? "—" : formatCurrency(contest.estimatedPrize)}
            </dd>
          </div>
        </dl>

        {unavailable ? (
          <p className="rounded-md bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
            {awaiting
              ? "Aguardando atualização do canal oficial. Assim que a informação do próximo concurso for publicada, ela aparece aqui."
              : "Informação do próximo concurso ainda não disponível."}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {informativeLabel ? null : (
            <Button asChild size="sm" variant="secondary" className="h-10">
              <Link to="/generate" search={{ lottery: lottery.slug }}>
                <Sparkles className="size-4" aria-hidden />
                Criar jogo
              </Link>
            </Button>
          )}
          <Button asChild size="sm" variant="ghost" className="h-10">
            <Link to="/contests" search={{ lottery: lottery.slug }}>
              <Trophy className="size-4" aria-hidden />
              Resultado
            </Link>
          </Button>
          {informativeLabel ? null : (
            <Button asChild size="sm" variant="ghost" className="h-10">
              <Link to="/games" search={{ lottery: lottery.slug }}>
                <CalendarDays className="size-4" aria-hidden />
                Meus jogos
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
