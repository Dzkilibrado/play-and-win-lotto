/**
 * Configuração parametrizada das modalidades.
 * Adicionar uma nova loteria = adicionar uma entrada aqui + linha no banco.
 * Nenhum componente deve repetir limites, faixas ou cores.
 */

export type LotterySlug = "mega-sena" | "lotofacil" | "quina";
export type LotteryColorKey = "mega" | "lotofacil" | "quina";

export interface PrizeTierConfig {
  hits: number;
  label: string;
}

export interface LotteryConfig {
  slug: LotterySlug;
  name: string;
  shortName: string;
  /** Chave usada em data-lottery para trocar os tokens de cor. */
  colorKey: LotteryColorKey;
  universe: { min: number; max: number };
  selectable: { min: number; max: number; base: number };
  /** Grade visual usada para volante e distribuição por linha/coluna. */
  grid: { columns: number };
  prizeTiers: PrizeTierConfig[];
  isActive: boolean;
  sortOrder: number;
}

export const lotteryConfigs: Record<LotterySlug, LotteryConfig> = {
  "mega-sena": {
    slug: "mega-sena",
    name: "Mega-Sena",
    shortName: "Mega",
    colorKey: "mega",
    universe: { min: 1, max: 60 },
    selectable: { min: 6, max: 20, base: 6 },
    grid: { columns: 10 },
    prizeTiers: [
      { hits: 6, label: "Sena" },
      { hits: 5, label: "Quina" },
      { hits: 4, label: "Quadra" },
    ],
    isActive: true,
    sortOrder: 1,
  },
  lotofacil: {
    slug: "lotofacil",
    name: "Lotofácil",
    shortName: "Lotofácil",
    colorKey: "lotofacil",
    universe: { min: 1, max: 25 },
    selectable: { min: 15, max: 20, base: 15 },
    grid: { columns: 5 },
    prizeTiers: [
      { hits: 15, label: "15 acertos" },
      { hits: 14, label: "14 acertos" },
      { hits: 13, label: "13 acertos" },
      { hits: 12, label: "12 acertos" },
      { hits: 11, label: "11 acertos" },
    ],
    isActive: true,
    sortOrder: 2,
  },
  quina: {
    slug: "quina",
    name: "Quina",
    shortName: "Quina",
    colorKey: "quina",
    universe: { min: 1, max: 80 },
    selectable: { min: 5, max: 15, base: 5 },
    grid: { columns: 10 },
    prizeTiers: [
      { hits: 5, label: "Quina" },
      { hits: 4, label: "Quadra" },
      { hits: 3, label: "Terno" },
      { hits: 2, label: "Duque" },
    ],
    isActive: true,
    sortOrder: 3,
  },
};

export const activeLotteries: LotteryConfig[] = Object.values(lotteryConfigs)
  .filter((lottery) => lottery.isActive)
  .sort((a, b) => a.sortOrder - b.sortOrder);

export function getLotteryConfig(slug: string | null | undefined): LotteryConfig | undefined {
  if (!slug) return undefined;
  return lotteryConfigs[slug as LotterySlug];
}

export function isValidSelectionSize(slug: LotterySlug, count: number) {
  const config = lotteryConfigs[slug];
  return count >= config.selectable.min && count <= config.selectable.max;
}

/** Combinações C(n, k) — usado para calcular quantidade de apostas simples. */
export function combinationCount(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i;
  }
  return Math.round(result);
}
