/**
 * Game Analyzer central. Nesta fase as métricas são apenas ANÁLISE —
 * nenhuma delas restringe a geração.
 */
import { fibonacciSet, isPrime } from "./math";
import { gridPosition } from "./rules";
import type { GameAnalysisResult, LotteryRules } from "./types";

export interface AnalyzerContext {
  /** Dezenas do concurso anterior/mais recente da modalidade. */
  lastDrawNumbers?: number[] | null;
  lastContestNumber?: number | null;
}

/** Chave canônica independente da ordem de geração. */
export function canonicalKey(numbers: number[]): string {
  return [...numbers]
    .sort((a, b) => a - b)
    .map((value) => String(value).padStart(2, "0"))
    .join("-");
}

export function analyzeGame(
  numbers: number[],
  rules: LotteryRules,
  context: AnalyzerContext = {},
): GameAnalysisResult {
  const sorted = [...numbers].sort((a, b) => a - b);
  const fibs = fibonacciSet(rules.universe.max);

  let evenCount = 0;
  let primeCount = 0;
  let fibonacciCount = 0;
  let sumTotal = 0;

  const rowDistribution: Record<string, number> = {};
  const columnDistribution: Record<string, number> = {};
  for (let row = 0; row < rules.grid.rows; row += 1) rowDistribution[String(row + 1)] = 0;
  for (let column = 0; column < rules.grid.columns; column += 1) {
    columnDistribution[String(column + 1)] = 0;
  }

  for (const value of sorted) {
    sumTotal += value;
    if (value % 2 === 0) evenCount += 1;
    if (isPrime(value)) primeCount += 1;
    if (fibs.has(value)) fibonacciCount += 1;
    const { row, column } = gridPosition(rules, value);
    rowDistribution[String(row + 1)] = (rowDistribution[String(row + 1)] ?? 0) + 1;
    columnDistribution[String(column + 1)] = (columnDistribution[String(column + 1)] ?? 0) + 1;
  }

  let maxSequence = sorted.length ? 1 : 0;
  let currentSequence = sorted.length ? 1 : 0;
  let maxGap = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index]! - sorted[index - 1]!;
    if (gap > maxGap) maxGap = gap;
    if (gap === 1) {
      currentSequence += 1;
      if (currentSequence > maxSequence) maxSequence = currentSequence;
    } else {
      currentSequence = 1;
    }
  }

  const last = context.lastDrawNumbers ?? null;
  const repeatedFromLast = last
    ? sorted.filter((value) => last.includes(value)).length
    : null;

  return {
    evenCount,
    oddCount: sorted.length - evenCount,
    sumTotal,
    primeCount,
    fibonacciCount,
    maxSequence,
    maxGap,
    rowDistribution,
    columnDistribution,
    repeatedFromLast,
    comparedToContest: last ? (context.lastContestNumber ?? null) : null,
  };
}
