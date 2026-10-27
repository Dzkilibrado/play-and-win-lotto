import { useQuery } from "@tanstack/react-query";

import { useSecondaryOptions } from "@/hooks/useSecondaryOptions";
import { formatCurrency, formatNumber } from "@/lib/format";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { secondaryLabel } from "@/lib/secondaryKeys";

/** Resultado oficial do Mês da Sorte / Time do Coração de um concurso. */
export function SecondaryResultSection({
  drawId,
  slug,
  lotteryId,
}: {
  drawId: string;
  slug: string | undefined;
  lotteryId: string | undefined;
}) {
  const secondary = useSecondaryOptions(slug, lotteryId);
  const result = useQuery({
    queryKey: ["contest-secondary-result", drawId],
    enabled: secondary.supported,
    queryFn: () => lotteryDataService.getSecondaryResult(drawId),
  });

  if (!secondary.supported || !result.data) return null;
  const { prize } = result.data;
  const drawn = result.data.result
    .map((value) => secondaryLabel(secondary.options, value))
    .filter(Boolean)
    .join(", ");

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="font-display text-sm font-semibold text-text-primary">{secondary.label}</h2>
      <p className="mt-2 text-sm text-text-primary">
        Sorteado: <span className="font-medium">{drawn}</span>
      </p>
      {prize ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-sm">
          <span className="font-medium text-text-primary">{prize.tier}</span>
          <span className="text-xs text-text-secondary">
            {formatNumber(prize.winners)} ganhador(es)
          </span>
          <span className="font-medium text-text-primary">
            {formatCurrency(prize.prize_per_winner)}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-text-secondary">
          A fonte oficial não informou o prêmio deste concurso.
        </p>
      )}
    </section>
  );
}
