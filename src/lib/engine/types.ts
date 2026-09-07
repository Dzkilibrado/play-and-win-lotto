/**
 * Tipos do motor de geração. Nenhuma dependência de React ou navegador.
 */
import type { LotteryColorKey, LotterySlug } from "@/config/lotteries";
import type { FilterStates, PreviousDrawReference } from "./filters/types";

export interface LotteryRules {
  slug: LotterySlug;
  name: string;
  colorKey: LotteryColorKey;
  universe: { min: number; max: number };
  selectable: { min: number; max: number; base: number };
  /** Grade do volante da modalidade (parametrizada, não assumida). */
  grid: { columns: number; rows: number };
}

export interface GenerationRequest {
  lotterySlug: string;
  numbersCount: number;
  gamesCount: number;
  fixed: number[];
  excluded: number[];
  /** Filtros opcionais da Fase 3B; ausente = comportamento do gerador básico. */
  filters?: FilterStates | null;
  /** Concurso de referência para o filtro de repetidas. */
  previousDraw?: PreviousDrawReference | null;
}

export type ValidationCode =
  | "INVALID_LOTTERY"
  | "INVALID_NUMBERS_COUNT"
  | "INVALID_GAMES_COUNT"
  | "GAMES_LIMIT"
  | "OUT_OF_UNIVERSE"
  | "DUPLICATED_NUMBER"
  | "FIXED_EXCLUDED_OVERLAP"
  | "TOO_MANY_FIXED"
  | "NOT_ENOUGH_AVAILABLE"
  | "NOT_ENOUGH_COMBINATIONS"
  | "FILTER";

export interface ValidationIssue {
  code: ValidationCode;
  message: string;
  /** Preenchido quando a incompatibilidade vem de um filtro específico. */
  filterId?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  /** C(A, N-F) — quantos jogos distintos existem com a configuração atual. */
  possibilities: number;
  rules: LotteryRules | null;
}

export interface GameAnalysisResult {
  evenCount: number;
  oddCount: number;
  sumTotal: number;
  primeCount: number;
  fibonacciCount: number;
  maxSequence: number;
  maxGap: number;
  /** Maior quantidade de dezenas ligadas pelo mesmo intervalo (saltos iguais). */
  maxEqualGapRun: number;
  rowDistribution: Record<string, number>;
  columnDistribution: Record<string, number>;
  repeatedFromLast: number | null;
  /** Concurso usado como referência para `repeatedFromLast`. */
  comparedToContest: number | null;
}

export interface GeneratedGameDraft {
  /** Posição no lote, 1-based. */
  index: number;
  numbers: number[];
  /** Chave canônica independente da ordem: "01-07-18-43-51-60". */
  key: string;
  analysis: GameAnalysisResult;
}

export type GenerationStopReason =
  | "complete"
  | "space_exhausted"
  | "attempt_limit"
  | "time_limit";

/** Diagnóstico interno da execução — não é exibido cru ao usuário. */
export interface GenerationMetrics {
  requested: number;
  generated: number;
  candidatesEvaluated: number;
  candidatesRejected: number;
  duplicatesDiscarded: number;
  durationMs: number;
  stopReason: GenerationStopReason;
  activeFilters: number;
}
