/**
 * Candidate Generator + Filter Engine + Duplicate Detector.
 *
 * Estratégia híbrida (mantida da Fase 3A e estendida na 3B):
 * 1. O validador já garantiu que a configuração é viável ANTES de qualquer laço.
 * 2. Espaço pequeno: enumeramos os índices combinatórios, embaralhamos e
 *    percorremos — assim conseguimos provar quando o espaço se esgotou.
 * 3. Espaço grande: sorteamos combinações distintas com limites seguros de
 *    tentativas e de tempo. Nunca existe `while(true)`.
 * 4. Todo candidato passa pelo Filter Engine (AND de todos os filtros ativos)
 *    e pelo Duplicate Detector (chave canônica).
 */
import { generationConfig } from "@/config/generation.config";
import { analyzeGame, canonicalKey, type AnalyzerContext } from "./analyzer";
import { buildCandidatePredicate, type FilterContext } from "./filters";
import { combinationsBig } from "./math";
import {
  cryptoRandomSource,
  randomBelow,
  randomBelowBig,
  shuffleInPlace,
  weightedSampleWithoutReplacement,
  type RandomSource,
} from "./random";
import { resolveRules, universeNumbers } from "./rules";
import { validateGenerationRequest } from "./validator";
import type {
  GeneratedGameDraft,
  GenerationMetrics,
  GenerationRequest,
  GenerationStopReason,
  ValidationResult,
} from "./types";

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

/** Amostra k itens distintos do pool (Fisher–Yates parcial). */
function sampleCombination(pool: number[], k: number, random: RandomSource): number[] {
  const copy = [...pool];
  for (let index = 0; index < k; index += 1) {
    const pick = index + randomBelow(random, copy.length - index);
    const temp = copy[index]!;
    copy[index] = copy[pick]!;
    copy[pick] = temp;
  }
  return copy.slice(0, k);
}

export interface GenerationOutcome {
  validation: ValidationResult;
  games: GeneratedGameDraft[];
  metrics: GenerationMetrics;
  /** true quando o motor encontrou menos jogos do que o pedido. */
  partial: boolean;
}

export function generateGames(
  request: GenerationRequest,
  options: {
    random?: RandomSource;
    analyzer?: AnalyzerContext;
    /** Sobrescreve os limites de segurança (usado em testes). */
    limits?: Partial<{ maxCandidatesTotal: number; maxDurationMs: number }>;
    now?: () => number;
  } = {},
): GenerationOutcome {
  const startedAt = (options.now ?? Date.now)();
  const validation = validateGenerationRequest(request);

  const emptyMetrics = (stopReason: GenerationStopReason): GenerationMetrics => ({
    requested: request.gamesCount,
    generated: 0,
    candidatesEvaluated: 0,
    candidatesRejected: 0,
    duplicatesDiscarded: 0,
    durationMs: 0,
    stopReason,
    activeFilters: 0,
  });

  if (!validation.ok || !validation.rules) {
    return { validation, games: [], metrics: emptyMetrics("complete"), partial: true };
  }

  const rules = validation.rules;
  const random = options.random ?? cryptoRandomSource;
  const fixed = [...new Set(request.fixed)].sort((a, b) => a - b);
  const excluded = new Set(request.excluded);
  const pool = universeNumbers(rules).filter(
    (value) => !excluded.has(value) && !fixed.includes(value),
  );
  const toChoose = request.numbersCount - fixed.length;
  const total = combinationsBig(pool.length, toChoose);

  const filterContext: FilterContext = {
    rules,
    numbersCount: request.numbersCount,
    fixed,
    pool,
    excluded: [...excluded],
    previousDraw: request.previousDraw ?? null,
  };
  const accepts = buildCandidatePredicate(request.filters, filterContext);
  const activeFilters = validation.activeFilters ?? 0;

  const maxDurationMs = options.limits?.maxDurationMs ?? generationConfig.maxDurationMs;
  const maxCandidates = Math.min(
    options.limits?.maxCandidatesTotal ?? generationConfig.maxCandidatesTotal,
    Math.max(
      generationConfig.maxCandidatesPerGame,
      request.gamesCount * generationConfig.maxCandidatesPerGame,
    ),
  );

  const games: GeneratedGameDraft[] = [];
  const seenKeys = new Set<string>();
  let candidatesEvaluated = 0;
  let candidatesRejected = 0;
  let duplicatesDiscarded = 0;
  let stopReason: GenerationStopReason = "complete";

  const buildNumbers = (chosen: number[]) => [...fixed, ...chosen].sort((a, b) => a - b);

  const consider = (numbers: number[]): boolean => {
    candidatesEvaluated += 1;
    const key = canonicalKey(numbers);
    if (seenKeys.has(key)) {
      duplicatesDiscarded += 1;
      return false;
    }
    if (!accepts(numbers)) {
      candidatesRejected += 1;
      return false;
    }
    seenKeys.add(key);
    games.push({
      index: games.length + 1,
      numbers,
      key,
      analysis: analyzeGame(numbers, rules, options.analyzer ?? {}),
    });
    return true;
  };

  const outOfTime = () => (options.now ?? Date.now)() - startedAt > maxDurationMs;

  const useEnumeration =
    total <= BigInt(generationConfig.exhaustiveEnumerationLimit) &&
    (activeFilters > 0 || BigInt(request.gamesCount) * 2n >= total);

  if (useEnumeration) {
    // Espaço pequeno: percorremos o espaço inteiro embaralhado.
    const ranks: bigint[] = [];
    for (let rank = 0n; rank < total; rank += 1n) ranks.push(rank);
    shuffleInPlace(ranks, random);
    stopReason = "space_exhausted";
    for (const rank of ranks) {
      if (games.length >= request.gamesCount) {
        stopReason = "complete";
        break;
      }
      if (candidatesEvaluated >= maxCandidates) {
        stopReason = "attempt_limit";
        break;
      }
      if (outOfTime()) {
        stopReason = "time_limit";
        break;
      }
      consider(buildNumbers(toChoose > 0 ? unrankCombination(pool, toChoose, rank) : []));
    }
  } else {
    // Espaço grande: amostragem aleatória com limites de tentativas e tempo.
    stopReason = "attempt_limit";
    while (candidatesEvaluated < maxCandidates) {
      if (games.length >= request.gamesCount) {
        stopReason = "complete";
        break;
      }
      if (outOfTime()) {
        stopReason = "time_limit";
        break;
      }
      const chosen =
        toChoose > 0
          ? total <= BigInt(Number.MAX_SAFE_INTEGER)
            ? sampleCombination(pool, toChoose, random)
            : unrankCombination(pool, toChoose, randomBelowBig(random, total))
          : [];
      consider(buildNumbers(chosen));
    }
  }

  const metrics: GenerationMetrics = {
    requested: request.gamesCount,
    generated: games.length,
    candidatesEvaluated,
    candidatesRejected,
    duplicatesDiscarded,
    durationMs: (options.now ?? Date.now)() - startedAt,
    stopReason,
    activeFilters,
  };

  return { validation, games, metrics, partial: games.length < request.gamesCount };
}

export { canonicalKey, resolveRules };
