/**
 * Configuração parametrizada das modalidades.
 * Adicionar uma nova loteria = adicionar uma entrada aqui + linha no banco.
 * Nenhum componente deve repetir limites, faixas ou cores.
 */

export type LotterySlug =
  | "mega-sena"
  | "lotofacil"
  | "quina"
  | "lotomania"
  | "dupla-sena"
  | "dia-de-sorte"
  | "timemania"
  | "mais-milionaria"
  | "super-sete";

export type LotteryColorKey =
  | "mega"
  | "lotofacil"
  | "quina"
  | "lotomania"
  | "dupla-sena"
  | "dia-de-sorte"
  | "timemania"
  | "mais-milionaria"
  | "super-sete";

export interface PrizeTierConfig {
  hits: number;
  label: string;
}

/** Tipo da seleção secundária opcional de uma modalidade. */
export type SecondaryPoolKind = "trevo" | "mes" | "time";

export interface SecondaryPoolConfig {
  kind: SecondaryPoolKind;
  label: string;
  universe: { min: number; max: number };
  selectable: { min: number; max: number; base: number };
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
  /** Quantos sorteios independentes um concurso produz (2 na Dupla Sena, 1 nas demais). */
  drawsPerContest: number;
  /**
   * Quantas dezenas o SORTEIO OFICIAL revela — normalmente igual a
   * `selectable.base` (a aposta simples tem o mesmo tamanho do sorteio),
   * mas a Lotomania quebra essa coincidência: sorteia 20 de um universo de
   * 100, enquanto a aposta (sem apostas múltiplas) é sempre de 50 dezenas.
   */
  drawnCount: number;
  /**
   * Seleção secundária opcional (trevo, mês da sorte, time do coração).
   * Ausente = modalidade usa só o pool principal de dezenas.
   */
  secondary?: SecondaryPoolConfig;
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
    drawsPerContest: 1,
    drawnCount: 6,
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
    drawsPerContest: 1,
    drawnCount: 15,
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
    drawsPerContest: 1,
    drawnCount: 5,
  },
  lotomania: {
    slug: "lotomania",
    name: "Lotomania",
    shortName: "Lotomania",
    colorKey: "lotomania",
    universe: { min: 1, max: 100 },
    // Lotomania não tem aposta múltipla: sempre exatamente 50 dezenas.
    selectable: { min: 50, max: 50, base: 50 },
    grid: { columns: 10 },
    prizeTiers: [
      { hits: 20, label: "20 acertos" },
      { hits: 19, label: "19 acertos" },
      { hits: 18, label: "18 acertos" },
      { hits: 17, label: "17 acertos" },
      { hits: 16, label: "16 acertos" },
      { hits: 15, label: "15 acertos" },
      { hits: 0, label: "Nenhum acerto" },
    ],
    isActive: true,
    sortOrder: 4,
    drawsPerContest: 1,
    // Sorteia 20 de um universo de 100 (a aposta é sempre de 50).
    drawnCount: 20,
  },
  "dupla-sena": {
    slug: "dupla-sena",
    name: "Dupla Sena",
    shortName: "Dupla Sena",
    colorKey: "dupla-sena",
    universe: { min: 1, max: 50 },
    selectable: { min: 6, max: 15, base: 6 },
    grid: { columns: 10 },
    prizeTiers: [
      { hits: 6, label: "Sena" },
      { hits: 5, label: "Quina" },
      { hits: 4, label: "Quadra" },
    ],
    // Ativa para criação manual, geração, orçamento e conferência — só a
    // SINCRONIZAÇÃO automática de resultados oficiais fica desligada por
    // enquanto (`lottery_sync_state.enabled = false`), porque gravar os 2
    // sorteios do mesmo concurso exige estender `persist_official_draw`,
    // deixado para o PR dedicado desta modalidade.
    isActive: true,
    sortOrder: 5,
    // Cada concurso tem 2 sorteios independentes; cada jogo é conferido contra os dois.
    drawsPerContest: 2,
    drawnCount: 6,
  },
  "dia-de-sorte": {
    slug: "dia-de-sorte",
    name: "Dia de Sorte",
    shortName: "Dia de Sorte",
    colorKey: "dia-de-sorte",
    universe: { min: 1, max: 31 },
    selectable: { min: 7, max: 15, base: 7 },
    grid: { columns: 31 },
    prizeTiers: [
      { hits: 7, label: "7 acertos" },
      { hits: 6, label: "6 acertos" },
      { hits: 5, label: "5 acertos" },
      { hits: 4, label: "4 acertos" },
    ],
    // Inativa: falta a seleção do Mês da Sorte (motor + tela + conferência) —
    // ver acompanhamento no PR dedicado a esta modalidade.
    isActive: false,
    sortOrder: 6,
    drawsPerContest: 1,
    drawnCount: 7,
    secondary: {
      kind: "mes",
      label: "Mês da Sorte",
      universe: { min: 1, max: 12 },
      selectable: { min: 1, max: 1, base: 1 },
    },
  },
  timemania: {
    slug: "timemania",
    name: "Timemania",
    shortName: "Timemania",
    colorKey: "timemania",
    universe: { min: 1, max: 80 },
    selectable: { min: 10, max: 15, base: 10 },
    grid: { columns: 10 },
    prizeTiers: [
      { hits: 7, label: "7 acertos" },
      { hits: 6, label: "6 acertos" },
      { hits: 5, label: "5 acertos" },
      { hits: 4, label: "4 acertos" },
      { hits: 3, label: "3 acertos" },
    ],
    // Inativa: falta a seleção do Time do Coração (motor + tela + conferência).
    isActive: false,
    sortOrder: 7,
    drawsPerContest: 1,
    drawnCount: 10,
    secondary: {
      kind: "time",
      label: "Time do Coração",
      universe: { min: 1, max: 80 },
      selectable: { min: 1, max: 1, base: 1 },
    },
  },
  "mais-milionaria": {
    slug: "mais-milionaria",
    name: "+Milionária",
    shortName: "+Milionária",
    colorKey: "mais-milionaria",
    universe: { min: 1, max: 50 },
    selectable: { min: 6, max: 12, base: 6 },
    grid: { columns: 10 },
    // Faixas reais são conjuntas (dezenas + trevos) — não cabem no modelo de
    // faixa única (`hits`) usado pelas demais modalidades. Preenchidas
    // quando o motor de faixa conjunta entrar, junto com a seleção de trevos.
    prizeTiers: [],
    isActive: false,
    sortOrder: 8,
    drawsPerContest: 1,
    drawnCount: 6,
    secondary: {
      kind: "trevo",
      label: "Trevo da Sorte",
      universe: { min: 1, max: 6 },
      selectable: { min: 2, max: 6, base: 2 },
    },
  },
  "super-sete": {
    slug: "super-sete",
    name: "Super Sete",
    shortName: "Super Sete",
    colorKey: "super-sete",
    // Universo por coluna (0-9); a semântica de "dezenas" não se aplica —
    // cada uma das 7 colunas tem seu próprio pool de dígitos independente.
    universe: { min: 0, max: 9 },
    selectable: { min: 1, max: 7, base: 1 },
    grid: { columns: 7 },
    prizeTiers: [],
    // Inativa: estrutura de 7 colunas independentes não cabe no motor atual
    // de "N dezenas de um pool único" — precisa de um gerador próprio.
    isActive: false,
    sortOrder: 9,
    drawsPerContest: 1,
    drawnCount: 7,
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
