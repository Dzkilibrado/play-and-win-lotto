/**
 * Conferência da seleção secundária (Mês da Sorte, Time do Coração).
 *
 * É uma camada pura sobre o resultado de `checkGame`: o prêmio da seleção
 * secundária é independente das dezenas — o Time do Coração paga mesmo sem
 * nenhum acerto — e SOMA com a faixa de dezenas quando as duas ocorrem.
 *
 * Regras:
 *  - jogo sem seleção secundária não concorre a esse prêmio (jogos antigos
 *    ou importados sem ela); o resultado das dezenas fica intacto;
 *  - a seleção é uma escolha única por jogo, então o prêmio conta 1 vez,
 *    mesmo em apostas de várias dezenas (nunca multiplicado pelas combinações);
 *  - valor ausente na fonte oficial vira "pendente", nunca 0.
 */
import { CheckError, type BreakdownEntry, type CheckOutcome } from "./checkEngine";

export interface SecondaryPrize {
  drawPrizeId: string | null;
  /** Valor oficial por acertador; `null` quando a fonte ainda não informou. */
  prizePerWinner: number | null;
}

export interface SecondaryCheckInput {
  /** Escolha do jogo (chaves canônicas). */
  selection: string[];
  /** Resultado oficial do concurso (chaves canônicas). */
  result: string[];
  /** Nome do prêmio, usado na decomposição ("Mês da Sorte"). */
  label: string;
  /** Faixa oficial do concurso; `null` quando a fonte não trouxe a faixa. */
  prize: SecondaryPrize | null;
}

/** Marca na decomposição: a faixa não depende de acertos de dezenas. */
export const SECONDARY_HITS_REQUIRED = 0;

export function checkSecondary(outcome: CheckOutcome, input: SecondaryCheckInput): CheckOutcome {
  const selection = [...new Set(input.selection)];
  if (selection.length === 0) return outcome;

  const result = [...new Set(input.result)];
  if (result.length === 0) {
    throw new CheckError("NO_DRAW_NUMBERS", `Concurso sem resultado de ${input.label}.`);
  }

  const resultSet = new Set(result);
  const matched = selection.some((value) => resultSet.has(value));
  if (!matched) return outcome;

  const prizePerCombination = input.prize?.prizePerWinner ?? null;
  const entry: BreakdownEntry = {
    drawPrizeId: input.prize?.drawPrizeId ?? null,
    tier: input.label,
    hitsRequired: SECONDARY_HITS_REQUIRED,
    winningCombinations: 1,
    prizePerCombination,
    totalForTier: prizePerCombination,
  };

  const breakdown = [...outcome.breakdown, entry];
  const known = breakdown.filter((item) => item.totalForTier != null);
  const hasMainTier = outcome.prizeTierHits != null;

  return {
    ...outcome,
    breakdown,
    isPrized: true,
    totalPrize: known.length
      ? known.reduce((sum, item) => sum + (item.totalForTier ?? 0), 0)
      : null,
    amountPending: breakdown.some((item) => item.prizePerCombination == null),
    // O "melhor prêmio" continua sendo o das dezenas; sem ele, vale o secundário.
    prizeTierHits: hasMainTier ? outcome.prizeTierHits : null,
    prizeLabel: hasMainTier ? outcome.prizeLabel : input.label,
  };
}
