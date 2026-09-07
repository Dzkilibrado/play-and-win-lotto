/**
 * Game Analyzer central.
 *
 * Todas as métricas vêm de `./metrics`, o MESMO módulo usado pelo Filter Engine —
 * não existem duas implementações de par, primo, Fibonacci, sequência ou grade.
 */
import {
  evenCount,
  fibonacciCount,
  gridDistribution,
  maxConsecutiveRun,
  maxEqualGapStreak,
  maxGap,
  primeCount,
  repeatedCount,
  sortedNumbers,
  sumTotal,
} from "./metrics";
import type { GameAnalysisResult, LotteryRules } from "./types";

export interface AnalyzerContext {
  /** Dezenas do concurso de referência (anterior ao concurso do jogo). */
  lastDrawNumbers?: number[] | null;
  lastContestNumber?: number | null;
}

/** Chave canônica independente da ordem de geração. */
export function canonicalKey(numbers: number[]): string {
  return sortedNumbers(numbers)
    .map((value) => String(value).padStart(2, "0"))
    .join("-");
}

export function analyzeGame(
  numbers: number[],
  rules: LotteryRules,
  context: AnalyzerContext = {},
): GameAnalysisResult {
  const sorted = sortedNumbers(numbers);
  const distribution = gridDistribution(sorted, rules);
  const evens = evenCount(sorted);
  const last = context.lastDrawNumbers ?? null;

  return {
    evenCount: evens,
    oddCount: sorted.length - evens,
    sumTotal: sumTotal(sorted),
    primeCount: primeCount(sorted),
    fibonacciCount: fibonacciCount(sorted, rules.universe.max),
    maxSequence: maxConsecutiveRun(sorted),
    maxGap: maxGap(sorted),
    maxEqualGapStreak: maxEqualGapStreak(sorted),
    rowDistribution: distribution.rows,
    columnDistribution: distribution.columns,
    repeatedFromLast: last ? repeatedCount(sorted, last) : null,
    comparedToContest: last ? (context.lastContestNumber ?? null) : null,
  };
}
