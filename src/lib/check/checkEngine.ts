/**
 * Motor de conferência — camada pura e determinística.
 *
 * Não conhece banco, rede nem interface: recebe as dezenas do jogo, as
 * dezenas oficiais e as faixas oficiais do concurso, e devolve acertos,
 * decomposição por faixa e total de premiação.
 *
 * REGRA CENTRAL (documentada e testada)
 * -------------------------------------
 * Uma aposta com `n` dezenas equivale a C(n, b) apostas simples de `b`
 * dezenas (b = tamanho da aposta simples da modalidade). Se o jogo acertou
 * `a` dezenas, a quantidade de apostas simples que atingem exatamente a
 * faixa de `f` acertos é:
 *
 *     combinações(f) = C(a, f) * C(n - a, b - f)
 *
 * Total da faixa = combinações(f) * valor oficial por acertador da faixa.
 *
 * A soma das faixas nunca é estimada: só entram faixas que existem no
 * resultado oficial do concurso.
 */
import { combinationsBig } from "@/lib/engine/math";
import { checkConfig } from "@/config/check.config";

export const checkCalculationVersion = checkConfig.calculationVersion;

export type CheckErrorType =
  | "NO_DRAW_NUMBERS"
  | "INVALID_GAME"
  | "INVALID_TIERS"
  | "LOTTERY_MISMATCH";

export class CheckError extends Error {
  constructor(
    readonly type: CheckErrorType,
    message: string,
  ) {
    super(message);
    this.name = "CheckError";
  }
}

export interface OfficialTier {
  drawPrizeId: string | null;
  tier: string;
  hits: number;
  /** Valor oficial por acertador; `null` quando a fonte ainda não informou. */
  prizePerWinner: number | null;
}

export interface CheckInput {
  gameNumbers: number[];
  drawNumbers: number[];
  /** Dezenas da aposta simples da modalidade (6 na Mega-Sena, 15 na Lotofácil…). */
  baseSize: number;
  tiers: OfficialTier[];
}

export interface BreakdownEntry {
  drawPrizeId: string | null;
  tier: string;
  hitsRequired: number;
  winningCombinations: number;
  prizePerCombination: number | null;
  totalForTier: number | null;
}

export interface CheckOutcome {
  hits: number;
  matchedNumbers: number[];
  /** Quantas apostas simples a aposta representa: C(n, b). */
  simpleBets: number;
  breakdown: BreakdownEntry[];
  isPrized: boolean;
  /** Soma das faixas com valor oficial informado; `null` se nenhuma tem valor. */
  totalPrize: number | null;
  /** Verdadeiro quando alguma faixa premiada ainda não tem valor oficial. */
  amountPending: boolean;
  prizeTierHits: number | null;
  prizeLabel: string | null;
  calculationVersion: number;
}

function asNumber(value: bigint): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

/** Conferência de um jogo contra um concurso oficial já sorteado. */
export function checkGame(input: CheckInput): CheckOutcome {
  const drawNumbers = [...new Set(input.drawNumbers)];
  if (drawNumbers.length === 0) {
    throw new CheckError("NO_DRAW_NUMBERS", "Concurso sem dezenas oficiais registradas.");
  }

  const gameNumbers = [...new Set(input.gameNumbers)];
  if (gameNumbers.length !== input.gameNumbers.length) {
    throw new CheckError("INVALID_GAME", "Jogo com dezenas repetidas.");
  }
  if (gameNumbers.length === 0) {
    throw new CheckError("INVALID_GAME", "Jogo sem dezenas registradas.");
  }
  if (!Number.isInteger(input.baseSize) || input.baseSize < 1) {
    throw new CheckError("INVALID_TIERS", "Tamanho da aposta simples inválido.");
  }
  if (gameNumbers.length < input.baseSize) {
    throw new CheckError(
      "INVALID_GAME",
      "Jogo com menos dezenas do que a aposta simples da modalidade.",
    );
  }

  const drawSet = new Set(drawNumbers);
  const matchedNumbers = gameNumbers.filter((value) => drawSet.has(value)).sort((a, b) => a - b);
  const hits = matchedNumbers.length;
  const size = gameNumbers.length;
  const base = input.baseSize;
  const simpleBets = asNumber(combinationsBig(size, base));

  const breakdown: BreakdownEntry[] = [];
  const seen = new Set<number>();

  for (const tier of [...input.tiers].sort((a, b) => b.hits - a.hits)) {
    if (!Number.isInteger(tier.hits) || tier.hits < 1) continue;
    if (seen.has(tier.hits)) continue;
    // Faixa impossível para o tamanho da aposta simples desta modalidade.
    if (tier.hits > base) continue;
    if (tier.hits > hits) continue;
    const remaining = base - tier.hits;
    if (remaining > size - hits) continue;

    const combinations =
      asNumber(combinationsBig(hits, tier.hits)) * asNumber(combinationsBig(size - hits, remaining));
    if (combinations <= 0) continue;

    seen.add(tier.hits);
    const prizePerCombination = tier.prizePerWinner;
    breakdown.push({
      drawPrizeId: tier.drawPrizeId,
      tier: tier.tier,
      hitsRequired: tier.hits,
      winningCombinations: combinations,
      prizePerCombination,
      totalForTier: prizePerCombination == null ? null : combinations * prizePerCombination,
    });
  }

  const isPrized = breakdown.length > 0;
  const known = breakdown.filter((entry) => entry.totalForTier != null);
  const totalPrize = known.length
    ? known.reduce((sum, entry) => sum + (entry.totalForTier ?? 0), 0)
    : null;
  const amountPending = breakdown.some((entry) => entry.prizePerCombination == null);
  const best = breakdown[0] ?? null;

  return {
    hits,
    matchedNumbers,
    simpleBets,
    breakdown,
    isPrized,
    totalPrize,
    amountPending,
    prizeTierHits: best ? best.hitsRequired : null,
    prizeLabel: best ? best.tier : null,
    calculationVersion: checkCalculationVersion,
  };
}
