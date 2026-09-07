/**
 * Contrato comum dos filtros de geração (Fase 3B).
 *
 * Filtros NÃO são previsões: apenas restringem o universo de jogos gerados
 * conforme características escolhidas pelo usuário.
 */
import type { LotteryRules } from "../types";

export type FilterId =
  | "parity"
  | "sum"
  | "rows"
  | "columns"
  | "repeated"
  | "consecutive"
  | "gapRun"
  | "fibonacci"
  | "prime";

export const filterIds: FilterId[] = [
  "parity",
  "sum",
  "rows",
  "columns",
  "repeated",
  "consecutive",
  "gapRun",
  "fibonacci",
  "prime",
];

/**
 * Versão do conjunto de regras — permite reinterpretar jogos antigos.
 * v1: "saltos" contava DEZENAS envolvidas no mesmo intervalo.
 * v2: "saltos" conta a QUANTIDADE de saltos iguais seguidos (definição atual).
 */
export const generationRulesVersion = 2;

export interface RangeConfig {
  min: number | null;
  max: number | null;
}

export interface LineConfig {
  /** Máximo de dezenas em uma mesma linha/coluna do volante. */
  maxPerLine: number | null;
  /** Faixa opcional de linhas/colunas ocupadas. */
  minOccupied: number | null;
  maxOccupied: number | null;
}

export interface MaxConfig {
  max: number | null;
}

/** Referência do "concurso anterior" para o filtro de repetidas. */
export type RepeatedReference = "previous-of-selected" | "latest-draw";

export interface RepeatedConfig extends RangeConfig {
  reference: RepeatedReference;
}

export interface FilterConfigMap {
  /** Faixa de dezenas PARES; os ímpares são derivados. */
  parity: RangeConfig;
  sum: RangeConfig;
  rows: LineConfig;
  columns: LineConfig;
  repeated: RepeatedConfig;
  consecutive: MaxConfig;
  gapRun: MaxConfig;
  fibonacci: RangeConfig;
  prime: RangeConfig;
}

export type FilterState<K extends FilterId = FilterId> = {
  enabled: boolean;
  config: FilterConfigMap[K];
};

export type FilterStates = { [K in FilterId]: FilterState<K> };

/** Snapshot estruturado e versionável salvo junto do jogo. */
export interface GenerationConstraints {
  version: number;
  filters: FilterStates;
}

export interface PreviousDrawReference {
  contestNumber: number | null;
  numbers: number[];
  /** Como essa referência foi obtida, para exibir ao usuário. */
  origin: RepeatedReference;
}

export interface FilterContext {
  rules: LotteryRules;
  numbersCount: number;
  fixed: number[];
  /** Dezenas disponíveis (universo sem fixas e sem excluídas). */
  pool: number[];
  excluded: number[];
  previousDraw: PreviousDrawReference | null;
}

export interface FilterIssue {
  filterId: FilterId;
  code: string;
  message: string;
}

export interface GameFilterDefinition<K extends FilterId> {
  id: K;
  /** Nome exibido ao usuário. */
  label: string;
  /** Explicação curta, sem jargão. */
  description: string;
  defaultConfig: FilterConfigMap[K];
  /** Se a configuração atual realmente restringe alguma coisa. */
  isConfigured(config: FilterConfigMap[K]): boolean;
  /** Detecta incompatibilidades ANTES de qualquer tentativa de geração. */
  validateConfiguration(config: FilterConfigMap[K], context: FilterContext): FilterIssue[];
  /** Avaliação de um candidato já montado. */
  evaluateCandidate(
    numbers: number[],
    config: FilterConfigMap[K],
    context: FilterContext,
  ): boolean;
  /** Resumo curto para chip/detalhe do jogo. */
  explain(config: FilterConfigMap[K], context: FilterContext): string;
}

export type AnyFilterDefinition = {
  [K in FilterId]: GameFilterDefinition<K>;
}[FilterId];
