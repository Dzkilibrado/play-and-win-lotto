import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Trophy } from "lucide-react";

import { MetricCard } from "@/components/common/Cards";
import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { NumberBall } from "@/components/lottery/NumberBall";
import { formatCurrency, formatDate } from "@/lib/format";
import { resolveQueryState } from "@/lib/query/queryState";
import { poolService, type PoolRow } from "@/lib/services/poolService";

export function PoolResultPanel({ pool, userId }: { pool: PoolRow; userId: string }) {
  const result = useQuery({
    queryKey: ["pool-result", pool.id, userId, pool.contest_id],
    queryFn: () => poolService.resultSnapshot(pool.id, pool.contest_id),
  });
  const state = resolveQueryState(result);
  if (state === "loading") return <LoadingState rows={2} label="Carregando resultado oficial…" />;
  if (state === "error") return <ErrorState onRetry={() => void result.refetch()} />;

  const snapshot = result.data;
  const applicable = snapshot?.games.filter((game) => game.status !== "PLANNED") ?? [];
  const checked = applicable.filter((game) => game.game_check_results);
  const prized = checked.filter((game) => game.game_check_results?.is_prized);
  const pending = Math.max(0, applicable.length - checked.length);
  const totalPrize = checked.reduce(
    (total, game) => total + Number(game.game_check_results?.total_prize ?? 0),
    0,
  );
  const amountPending = prized.some((game) => game.game_check_results?.amount_pending);

  if (!snapshot?.draw) {
    return (
      <div className="surface-card flex items-start gap-3 p-4">
        <Clock className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <h2 className="font-display text-sm font-semibold text-text-primary">Aguardando resultado oficial</h2>
          <p className="mt-1 text-sm text-text-secondary">
            O bolão continua disponível enquanto o resultado do concurso é importado e validado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="surface-card space-y-4 p-4" aria-labelledby="pool-result-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="pool-result-title" className="font-display text-sm font-semibold text-text-primary">
            Resultado oficial · Concurso {snapshot.draw.contest_number}
          </h2>
          <p className="text-xs text-text-secondary">Sorteio em {formatDate(snapshot.draw.draw_date)}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          {pending > 0 ? "Conferência em andamento" : "Conferido"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Dezenas sorteadas">
        {[...snapshot.draw.draw_numbers]
          .sort((a, b) => a.position - b.position)
          .map((item) => <NumberBall key={item.number} value={item.number} size="sm" variant="lottery" />)}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="Jogos conferidos" value={`${checked.length} de ${applicable.length}`} />
        <MetricCard label="Premiados" value={prized.length} />
        <MetricCard label="Não premiados" value={checked.length - prized.length} />
        <MetricCard
          label="Premiação total"
          value={amountPending ? "Valor pendente" : formatCurrency(totalPrize)}
        />
      </div>

      {pending > 0 ? (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {pending} {pending === 1 ? "jogo aguarda" : "jogos aguardam"} a conferência automática.
        </p>
      ) : prized.length > 0 ? (
        <p className="inline-flex items-center gap-2 text-sm font-medium text-success">
          <Trophy className="size-4" aria-hidden />
          {prized.length} {prized.length === 1 ? "jogo premiado" : "jogos premiados"}
        </p>
      ) : null}
    </section>
  );
}