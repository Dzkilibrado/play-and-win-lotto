/**
 * Candidate Generator + Duplicate Detector.
 *
 * Estratégia: nunca sorteamos jogos "às cegas" em laço aberto.
 * 1. O validador já garantiu que existem combinações suficientes.
 * 2. Cada jogo corresponde a um índice (rank) do sistema combinatório.
 *    Sorteamos ranks DISTINTOS e "desrankeamos" cada um — duas execuções
 *    nunca produzem o mesmo jogo dentro do lote, sem tentativa e erro.
 * 3. Se o espaço for pequeno (ou o pedido cobrir boa parte dele),
 *    enumeramos os ranks, embaralhamos e cortamos na quantidade pedida.
 */
import { generationConfig } from "@/config/generation.config";
import { analyzeGame, canonicalKey, type AnalyzerContext } from "./analyzer";
import { combinationsBig } from "./math";
import { cryptoRandomSource, randomBelowBig, shuffleInPlace, type RandomSource } from "./random";
import { resolveRules, universeNumbers } from "./rules";
import { validateGenerationRequest } from "./validator";
import type { GeneratedGameDraft, GenerationRequest, ValidationResult } from "./types";

/** Combinação de índice `rank` (sistema combinatório) escolhendo k de pool. */
function unrankCombination(pool: number[], k: number, rank: bigint): number[] {
  const result: number[] = [];
  let remainingRank = rank;
  let start = 0;
  let toChoose = k;
  let remainingPool = pool.length;

  while (toChoose > 0) {
    const withoutFirst = combinationsBig(remainingPool - 1, toChoose - 1);
    if (remainingRank < withoutFirst) {
      result.push(pool[start]!);
      toChoose -= 1;
    } else {
      remainingRank -= withoutFirst;
    }
    start += 1;
    remainingPool -= 1;
  }
  return result;
}

export interface GenerationOutcome {
  validation: ValidationResult;
  games: GeneratedGameDraft[];
}

export function generateGames(
  request: GenerationRequest,
  options: { random?: RandomSource; analyzer?: AnalyzerContext } = {},
): GenerationOutcome {
  const validation = validateGenerationRequest(request);
  if (!validation.ok || !validation.rules) return { validation, games: [] };

  const rules = validation.rules;
  const random = options.random ?? cryptoRandomSource;
  const fixed = [...new Set(request.fixed)].sort((a, b) => a - b);
  const excluded = new Set(request.excluded);
  const pool = universeNumbers(rules).filter(
    (value) => !excluded.has(value) && !fixed.includes(value),
  );
  const toChoose = request.numbersCount - fixed.length;
  const total = combinationsBig(pool.length, toChoose);

  const ranks: bigint[] = [];
  const wantsMostOfSpace = BigInt(request.gamesCount) * 2n >= total;

  if (total <= BigInt(generationConfig.exhaustiveEnumerationLimit) && wantsMostOfSpace) {
    const all: bigint[] = [];
    for (let rank = 0n; rank < total; rank += 1n) all.push(rank);
    shuffleInPlace(all, random);
    ranks.push(...all.slice(0, request.gamesCount));
  } else {
    const seen = new Set<string>();
    while (ranks.length < request.gamesCount) {
      const rank = randomBelowBig(random, total);
      const key = rank.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      ranks.push(rank);
    }
  }

  const games = ranks.map((rank, index) => {
    const chosen = toChoose > 0 ? unrankCombination(pool, toChoose, rank) : [];
    const numbers = [...fixed, ...chosen].sort((a, b) => a - b);
    return {
      index: index + 1,
      numbers,
      key: canonicalKey(numbers),
      analysis: analyzeGame(numbers, rules, options.analyzer ?? {}),
    } satisfies GeneratedGameDraft;
  });

  return { validation, games };
}

export { canonicalKey, resolveRules };
