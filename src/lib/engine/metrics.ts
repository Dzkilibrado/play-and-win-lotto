/**
 * Métricas matemáticas compartilhadas.
 *
 * REGRA: Analyzer e Filter Engine NUNCA reimplementam estes conceitos.
 * Qualquer noção de par, primo, Fibonacci, sequência, salto, linha ou coluna
 * vem exclusivamente deste módulo.
 */
import { fibonacciSet, isPrime } from "./math";
import { gridPosition } from "./rules";
import type { LotteryRules } from "./types";

export function sortedNumbers(numbers: number[]): number[] {
  return [...numbers].sort((a, b) => a - b);
}

export function evenCount(numbers: number[]): number {
  return numbers.filter((value) => value % 2 === 0).length;
}

export function oddCount(numbers: number[]): number {
  return numbers.length - evenCount(numbers);
}

export function sumTotal(numbers: number[]): number {
  return numbers.reduce((total, value) => total + value, 0);
}

export function primeCount(numbers: number[]): number {
  return numbers.filter((value) => isPrime(value)).length;
}

export function fibonacciCount(numbers: number[], universeMax: number): number {
  const fibs = fibonacciSet(universeMax);
  return numbers.filter((value) => fibs.has(value)).length;
}

/** Diferenças entre dezenas consecutivas do jogo ordenado. */
export function gaps(numbers: number[]): number[] {
  const sorted = sortedNumbers(numbers);
  const result: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    result.push(sorted[index]! - sorted[index - 1]!);
  }
  return result;
}

/** Maior distância entre duas dezenas vizinhas (métrica distinta de saltos iguais). */
export function maxGap(numbers: number[]): number {
  const list = gaps(numbers);
  return list.length ? Math.max(...list) : 0;
}

/**
 * Maior quantidade de dezenas numericamente consecutivas.
 * 10,11 → 2 · 10,11,12 → 3 · 10,11,12,13 → 4
 */
export function maxConsecutiveRun(numbers: number[]): number {
  const sorted = sortedNumbers(numbers);
  if (!sorted.length) return 0;
  let best = 1;
  let current = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]! - sorted[index - 1]! === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

/**
 * Sequência de saltos — definição adotada:
 * dado o jogo ordenado n1<n2<...<nk e gap[i] = n[i+1]-n[i],
 * a métrica é o maior número de DEZENAS envolvidas em saltos iguais seguidos.
 * 05,10,15,20 → gaps 5,5,5 → 3 saltos iguais seguidos → 4 dezenas na sequência.
 * Retornamos o comprimento em dezenas (mínimo 1 para jogos não vazios).
 */
export function maxEqualGapRun(numbers: number[]): number {
  const list = gaps(numbers);
  if (!list.length) return numbers.length ? 1 : 0;
  let bestGaps = 1;
  let currentGaps = 1;
  for (let index = 1; index < list.length; index += 1) {
    if (list[index] === list[index - 1]) {
      currentGaps += 1;
      if (currentGaps > bestGaps) bestGaps = currentGaps;
    } else {
      currentGaps = 1;
    }
  }
  return bestGaps + 1;
}

export interface GridDistribution {
  rows: Record<string, number>;
  columns: Record<string, number>;
  maxPerRow: number;
  maxPerColumn: number;
  occupiedRows: number;
  occupiedColumns: number;
}

/** Distribuição no volante oficial da modalidade (geometria centralizada em rules). */
export function gridDistribution(numbers: number[], rules: LotteryRules): GridDistribution {
  const rows: Record<string, number> = {};
  const columns: Record<string, number> = {};
  for (let row = 0; row < rules.grid.rows; row += 1) rows[String(row + 1)] = 0;
  for (let column = 0; column < rules.grid.columns; column += 1) columns[String(column + 1)] = 0;

  for (const value of numbers) {
    const position = gridPosition(rules, value);
    const rowKey = String(position.row + 1);
    const columnKey = String(position.column + 1);
    rows[rowKey] = (rows[rowKey] ?? 0) + 1;
    columns[columnKey] = (columns[columnKey] ?? 0) + 1;
  }

  const rowValues = Object.values(rows);
  const columnValues = Object.values(columns);
  return {
    rows,
    columns,
    maxPerRow: rowValues.length ? Math.max(...rowValues) : 0,
    maxPerColumn: columnValues.length ? Math.max(...columnValues) : 0,
    occupiedRows: rowValues.filter((value) => value > 0).length,
    occupiedColumns: columnValues.filter((value) => value > 0).length,
  };
}

/** Quantas dezenas do jogo também estavam no concurso de referência. */
export function repeatedCount(numbers: number[], reference: number[]): number {
  const set = new Set(reference);
  return numbers.filter((value) => set.has(value)).length;
}
