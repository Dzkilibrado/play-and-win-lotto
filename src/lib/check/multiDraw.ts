/**
 * Conferência de um jogo contra todos os sorteios de um concurso.
 *
 * A maioria das modalidades tem 1 sorteio por concurso; a Dupla Sena tem 2,
 * cada um com suas próprias dezenas e faixas. Cada sorteio é conferido
 * separadamente pelo motor puro (`checkGame`) e o resultado SOMADO do jogo
 * é o que bolão, rateio e filtros já consomem.
 *
 * Com 1 sorteio o resultado é exatamente o de `checkGame` (nenhum rótulo é
 * alterado); com mais de um, as faixas ganham o prefixo "1º sorteio — ".
 */
import {
  CheckError,
  checkGame,
  type BreakdownEntry,
  type CheckOutcome,
  type OfficialTier,
} from "./checkEngine";

export interface DrawToCheck {
  /** 1 = primeiro sorteio, 2 = segundo sorteio. */
  sequence: number;
  drawNumbers: number[];
  tiers: OfficialTier[];
}

export interface DrawOutcome {
  sequence: number;
  outcome: CheckOutcome;
}

export interface MultiDrawOutcome {
  /** Resultado somado do jogo (o que vai para `game_check_results`). */
  aggregate: CheckOutcome;
  /** Resultado de cada sorteio; só tem utilidade quando há mais de um. */
  draws: DrawOutcome[];
}

export function drawOrdinal(sequence: number): string {
  return `${sequence}º sorteio`;
}

export function checkGameAcrossDraws(input: {
  gameNumbers: number[];
  baseSize: number;
  draws: DrawToCheck[];
}): MultiDrawOutcome {
  if (input.draws.length === 0) {
    throw new CheckError("NO_DRAW_NUMBERS", "Concurso sem sorteios oficiais registrados.");
  }
  const draws: DrawOutcome[] = [...input.draws]
    .sort((a, b) => a.sequence - b.sequence)
    .map((draw) => ({
      sequence: draw.sequence,
      outcome: checkGame({
        gameNumbers: input.gameNumbers,
        drawNumbers: draw.drawNumbers,
        baseSize: input.baseSize,
        tiers: draw.tiers,
      }),
    }));

  const only = draws[0];
  if (draws.length === 1 && only) return { aggregate: only.outcome, draws };

  const first = draws[0]!.outcome;

  const breakdown: BreakdownEntry[] = draws.flatMap(({ sequence, outcome }) =>
    outcome.breakdown.map((entry) => ({
      ...entry,
      tier: `${drawOrdinal(sequence)} — ${entry.tier}`,
    })),
  );

  // O "melhor" sorteio: mais acertos; empate fica com o primeiro.
  const best = draws.reduce((acc, current) =>
    current.outcome.hits > acc.outcome.hits ? current : acc,
  );

  const prizedDraws = draws.filter((item) => item.outcome.isPrized);
  const bestTier = prizedDraws.reduce<DrawOutcome | null>((acc, current) => {
    const hits = current.outcome.prizeTierHits ?? -1;
    if (!acc) return current;
    return hits > (acc.outcome.prizeTierHits ?? -1) ? current : acc;
  }, null);

  const knownTotals = draws
    .map((item) => item.outcome.totalPrize)
    .filter((value): value is number => value != null);

  const aggregate: CheckOutcome = {
    hits: best.outcome.hits,
    matchedNumbers: best.outcome.matchedNumbers,
    simpleBets: first.simpleBets,
    breakdown,
    isPrized: prizedDraws.length > 0,
    totalPrize: knownTotals.length ? knownTotals.reduce((sum, value) => sum + value, 0) : null,
    amountPending: draws.some((item) => item.outcome.amountPending),
    prizeTierHits: bestTier ? bestTier.outcome.prizeTierHits : null,
    prizeLabel:
      bestTier && bestTier.outcome.prizeLabel
        ? `${drawOrdinal(bestTier.sequence)} — ${bestTier.outcome.prizeLabel}`
        : null,
    calculationVersion: first.calculationVersion,
  };

  return { aggregate, draws };
}
