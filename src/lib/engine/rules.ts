/**
 * Lottery Rules: traduz a configuração central em regras usáveis pelo motor.
 * Nenhum limite de modalidade é redigitado aqui.
 */
import { getLotteryConfig } from "@/config/lotteries";
import type { LotteryRules } from "./types";

export function resolveRules(slug: string | null | undefined): LotteryRules | null {
  const config = getLotteryConfig(slug);
  if (!config) return null;
  const size = config.universe.max - config.universe.min + 1;
  return {
    slug: config.slug,
    name: config.name,
    colorKey: config.colorKey,
    universe: config.universe,
    selectable: config.selectable,
    grid: { columns: config.grid.columns, rows: Math.ceil(size / config.grid.columns) },
  };
}

export function universeNumbers(rules: LotteryRules): number[] {
  const size = rules.universe.max - rules.universe.min + 1;
  return Array.from({ length: size }, (_, index) => rules.universe.min + index);
}

export function allowedNumbersCounts(rules: LotteryRules): number[] {
  const { min, max } = rules.selectable;
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

/** Posição da dezena no volante da modalidade (0-based). */
export function gridPosition(rules: LotteryRules, value: number) {
  const offset = value - rules.universe.min;
  return { row: Math.floor(offset / rules.grid.columns), column: offset % rules.grid.columns };
}
