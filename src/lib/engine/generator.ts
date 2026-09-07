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
  randomUnit,
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

  /**
   * Ponderação estatística (opcional). Os pesos influenciam APENAS a montagem
   * do candidato: fixas continuam obrigatórias, excluídas continuam fora do
   * pool e todos os filtros continuam sendo aplicados depois.
   */
  const weightVector = request.weights ?? null;
  const weightByNumber = new Map<number, number>();
  if (weightVector) {
    for (let index = 0; index < weightVector.numbers.length; index += 1) {
      const value = weightVector.values[index];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        weightByNumber.set(weightVector.numbers[index]!, value);
      }
    }
  }
  // Uma dezena elegível sem peso informado nunca vira impossível: recebe 1.
  const weightOf = (value: number) => weightByNumber.get(value) ?? 1;
  const poolWeights = pool.map(weightOf);
  const weighted = Boolean(weightVector) && poolWeights.some((value) => value !== poolWeights[0]);

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

  /**
   * PODA BARATA (só quando há pesos): quando o filtro de pares/ímpares está
   * ativo, montamos o candidato já com uma quantidade de pares viável em vez
   * de sortear e descartar depois. A verificação completa dos filtros continua
   * acontecendo — a poda apenas evita trabalho desperdiçado.
   */
  const parityState = request.filters?.parity;
  const parityPlan = (() => {
    if (!weighted || !parityState?.enabled) return null;
    const { min, max } = parityState.config;
    if (min == null && max == null) return null;
    const isEven = (value: number) => value % 2 === 0;
    const evensPool = pool.filter(isEven);
    const oddsPool = pool.filter((value) => !isEven(value));
    const fixedEven = fixed.filter(isEven).length;
    const minEven = Math.max(min ?? 0, fixedEven, fixedEven + toChoose - oddsPool.length);
    const maxEven = Math.min(
      max ?? request.numbersCount,
      fixedEven + Math.min(toChoose, evensPool.length),
    );
    if (minEven > maxEven) return null;
    return { evensPool, oddsPool, fixedEven, minEven, maxEven };
  })();

  const sampleWeightedChosen = (): number[] => {
    if (!parityPlan) {
      return weightedSampleWithoutReplacement(pool, weightOf, toChoose, random);
    }
    const targetEven =
      parityPlan.minEven + randomBelow(random, parityPlan.maxEven - parityPlan.minEven + 1);
    const needEven = Math.max(0, targetEven - parityPlan.fixedEven);
    const needOdd = toChoose - needEven;
    if (needOdd < 0 || needOdd > parityPlan.oddsPool.length) {
      return weightedSampleWithoutReplacement(pool, weightOf, toChoose, random);
    }
    return [
      ...weightedSampleWithoutReplacement(parityPlan.evensPool, weightOf, needEven, random),
      ...weightedSampleWithoutReplacement(parityPlan.oddsPool, weightOf, needOdd, random),
    ];
  };


  /**
   * Peso do JOGO a partir dos pesos das dezenas: MÉDIA GEOMÉTRICA em log-space,
   * exp( (1/k) * Σ ln w_i ). Escolhida por ser estável (sem underflow/overflow
   * do produto direto) e independente da quantidade de dezenas, então não
   * favorece jogos maiores. Ela apenas reflete a preferência já definida pelos
   * pesos individuais — não é uma estratégia nova.
   */
  const candidateWeight = (numbers: number[]) => {
    let logSum = 0;
    for (const value of numbers) logSum += Math.log(Math.max(weightOf(value), 1e-9));
    return Math.exp(logSum / numbers.length);
  };

  // Enumeração ponderada: espaço gerenciável + pesos ativos.
  const useWeightedEnumeration =
    weighted &&
    toChoose > 0 &&
    total <= BigInt(generationConfig.weightedEnumerationLimit);

  // Sem pesos, o caminho eficiente da Fase 3B permanece intacto.
  const useEnumeration =
    !weighted &&
    total <= BigInt(generationConfig.exhaustiveEnumerationLimit) &&
    (activeFilters > 0 || BigInt(request.gamesCount) * 2n >= total);

  let samplingMode: NonNullable<GenerationMetrics["samplingMode"]> = weighted
    ? "weighted_sampling"
    : useEnumeration
      ? "uniform_enumeration"
      : "uniform_sampling";

  if (useWeightedEnumeration) {
    samplingMode = "weighted_enumeration";
    /**
     * Seleção ponderada sem reposição entre TODOS os candidatos válidos
     * (Efraimidis–Spirakis): chave = ln(u)/w; os k maiores formam a amostra.
     * Mantemos apenas os k melhores num heap de mínimo — memória O(k).
     */
    const keys: number[] = [];
    const items: number[][] = [];
    const wanted = request.gamesCount;

    const swap = (a: number, b: number) => {
      const key = keys[a]!;
      keys[a] = keys[b]!;
      keys[b] = key;
      const item = items[a]!;
      items[a] = items[b]!;
      items[b] = item;
    };
    const siftUp = (start: number) => {
      let index = start;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (keys[parent]! <= keys[index]!) break;
        swap(parent, index);
        index = parent;
      }
    };
    const siftDown = () => {
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < keys.length && keys[left]! < keys[smallest]!) smallest = left;
        if (right < keys.length && keys[right]! < keys[smallest]!) smallest = right;
        if (smallest === index) break;
        swap(smallest, index);
        index = smallest;
      }
    };

    const enumerationBudget =
      options.limits?.maxDurationMs ?? generationConfig.weightedEnumerationDurationMs;
    const enumerationOutOfTime = () =>
      (options.now ?? Date.now)() - startedAt > enumerationBudget;

    stopReason = "space_exhausted";
    for (let rank = 0n; rank < total; rank += 1n) {
      if (candidatesEvaluated % 512 === 0 && enumerationOutOfTime()) {
        stopReason = "time_limit";
        break;
      }
      const numbers = buildNumbers(unrankCombination(pool, toChoose, rank));
      candidatesEvaluated += 1;
      if (!accepts(numbers)) {
        candidatesRejected += 1;
        continue;
      }
      // ln(u)/w: peso maior ⇒ chave tipicamente maior ⇒ mais chance de entrar.
      const key = Math.log(Math.max(randomUnit(random), Number.MIN_VALUE)) / candidateWeight(numbers);
      if (keys.length < wanted) {
        keys.push(key);
        items.push(numbers);
        siftUp(keys.length - 1);
      } else if (key > keys[0]!) {
        keys[0] = key;
        items[0] = numbers;
        siftDown();
      }
    }

    // Ordena do maior para o menor peso sorteado e materializa os jogos.
    const order = keys.map((key, index) => ({ key, index })).sort((a, b) => b.key - a.key);
    for (const entry of order) {
      const numbers = items[entry.index]!;
      const canonical = canonicalKey(numbers);
      if (seenKeys.has(canonical)) continue;
      seenKeys.add(canonical);
      games.push({
        index: games.length + 1,
        numbers,
        key: canonical,
        analysis: analyzeGame(numbers, rules, options.analyzer ?? {}),
      });
    }
    if (games.length >= request.gamesCount) stopReason = "complete";
  } else if (useEnumeration) {
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
        toChoose <= 0
          ? []
          : weighted
            ? sampleWeightedChosen()
            : total <= BigInt(Number.MAX_SAFE_INTEGER)
              ? sampleCombination(pool, toChoose, random)
              : unrankCombination(pool, toChoose, randomBelowBig(random, total));
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
    weights: weightVector
      ? {
          strategyId: weightVector.strategyId,
          intensity: weightVector.intensity,
          window: weightVector.window,
          contestsAnalyzed: weightVector.contestsAnalyzed,
          lastContestConsidered: weightVector.lastContestConsidered,
          weightMin: poolWeights.length ? Math.min(...poolWeights) : 1,
          weightMax: poolWeights.length ? Math.max(...poolWeights) : 1,
        }
      : null,
  };

  return { validation, games, metrics, partial: games.length < request.gamesCount };
}

export { canonicalKey, resolveRules };
