/**
 * Conferência de faixas CONJUNTAS (dezenas + trevos) — +Milionária.
 *
 * Uma aposta com `n` dezenas e `t` trevos equivale a C(n,6) × C(t,2) apostas
 * simples. Se o jogo acertou `a` dezenas e `c` dos 2 trevos sorteados, as
 * apostas simples que caem numa faixa (f dezenas, g trevos) são:
 *
 *     dezenas(f) = C(a, f) × C(n − a, 6 − f)
 *     trevos(g)  = C(c, g) × C(t − c, 2 − g)
 *
 * Uma faixa aceita um conjunto de g (ex.: "1 ou nenhum trevo" = {0, 1}); o
 * total da faixa soma trevos(g) sobre o conjunto e multiplica por dezenas(f).
 * Como cada aposta simples cai em UMA só faixa, não há dupla contagem.
 *
 * Camada pura: sem banco, rede ou interface.
 */
import { combinationsBig } from "@/lib/engine/math";
import type { JointTierDef } from "@/config/lotteries";
import {
  CheckError,
  checkCalculationVersion,
  type BreakdownEntry,
  type CheckOutcome,
  type OfficialTier,
} from "./checkEngine";

export interface JointCheckInput {
  gameNumbers: number[];
  /** Trevos escolhidos no jogo (2 a 6). */
  gameClovers: number[];
  drawNumbers: number[];
  /** Os 2 trevos sorteados. */
  drawClovers: number[];
  /** Dezenas da aposta simples (6). */
  baseSize: number;
  /** Trevos da aposta simples (2). */
  cloverBase: number;
  /** Definição das faixas, da mais alta para a mais baixa. */
  defs: JointTierDef[];
  /** Faixas oficiais do concurso; `hits` é a chave da faixa. */
  tiers: OfficialTier[];
}

function count(n: bigint): number {
  const value = Number(n);
  return Number.isFinite(value) ? value : 0;
}

function choose(n: number, k: number): number {
  if (k < 0 || n < 0 || k > n) return 0;
  return count(combinationsBig(n, k));
}

export function checkJointGame(input: JointCheckInput): CheckOutcome {
  const drawNumbers = [...new Set(input.drawNumbers)];
  const drawClovers = [...new Set(input.drawClovers)];
  if (drawNumbers.length === 0 || drawClovers.length !== input.cloverBase) {
    throw new CheckError("NO_DRAW_NUMBERS", "Concurso sem dezenas e trevos oficiais registrados.");
  }

  const gameNumbers = [...new Set(input.gameNumbers)];
  const gameClovers = [...new Set(input.gameClovers)];
  if (
    gameNumbers.length !== input.gameNumbers.length ||
    gameClovers.length !== input.gameClovers.length
  ) {
    throw new CheckError("INVALID_GAME", "Jogo com dezenas ou trevos repetidos.");
  }
  if (gameNumbers.length < input.baseSize) {
    throw new CheckError("INVALID_GAME", "Jogo com menos dezenas do que a aposta simples.");
  }
  if (gameClovers.length < input.cloverBase) {
    throw new CheckError("INVALID_GAME", "Jogo com menos trevos do que a aposta simples.");
  }

  const drawSet = new Set(drawNumbers);
  const matchedNumbers = gameNumbers.filter((value) => drawSet.has(value)).sort((a, b) => a - b);
  const hits = matchedNumbers.length;
  const n = gameNumbers.length;
  const t = gameClovers.length;
  const cloverSet = new Set(drawClovers);
  const cloverHits = gameClovers.filter((value) => cloverSet.has(value)).length;

  const byKey = new Map(input.tiers.map((tier) => [tier.hits, tier]));
  const breakdown: BreakdownEntry[] = [];

  for (const def of input.defs) {
    const official = byKey.get(def.key);
    // Faixa que a fonte não trouxe não entra: nunca se inventa prêmio.
    if (!official) continue;
    const numberCombos =
      choose(hits, def.numberHits) * choose(n - hits, input.baseSize - def.numberHits);
    if (numberCombos <= 0) continue;
    const cloverCombos = def.cloverHits.reduce(
      (sum, g) => sum + choose(cloverHits, g) * choose(t - cloverHits, input.cloverBase - g),
      0,
    );
    const combinations = numberCombos * cloverCombos;
    if (combinations <= 0) continue;

    breakdown.push({
      drawPrizeId: official.drawPrizeId,
      tier: official.tier,
      hitsRequired: def.key,
      winningCombinations: combinations,
      prizePerCombination: official.prizePerWinner,
      totalForTier: official.prizePerWinner == null ? null : combinations * official.prizePerWinner,
    });
  }

  const known = breakdown.filter((entry) => entry.totalForTier != null);
  const best = breakdown[0] ?? null;

  return {
    hits,
    matchedNumbers,
    simpleBets: choose(n, input.baseSize) * choose(t, input.cloverBase),
    breakdown,
    isPrized: breakdown.length > 0,
    totalPrize: known.length
      ? known.reduce((sum, entry) => sum + (entry.totalForTier ?? 0), 0)
      : null,
    amountPending: breakdown.some((entry) => entry.prizePerCombination == null),
    prizeTierHits: best ? best.hitsRequired : null,
    prizeLabel: best ? best.tier : null,
    calculationVersion: checkCalculationVersion,
  };
}
