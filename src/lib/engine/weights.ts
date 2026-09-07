/**
 * Motor de ponderação estatística (Pesos Inteligentes).
 *
 * Determinístico e auditável: nenhuma IA generativa participa da escolha das
 * dezenas. O módulo transforma indicadores históricos agregados (vindos do
 * banco) em um peso positivo e limitado por dezena.
 *
 * Fórmulas (documentadas e testadas):
 *   recentFrequency      = recentOccurrences / windowContests
 *   historicalFrequency  = totalOccurrences  / contestsAnalyzed
 *   delay                = drawsSinceLastAppearance
 *                          (0 = saiu no concurso imediatamente anterior)
 *   normalização das frequências = min-max dentro do pool elegível
 *   normalização do atraso       = log1p(atraso) / log1p(cap), cap = percentil 90
 *   rawScore        = Σ coeficiente_i * indicadorNormalizado_i   (Σ coef = 1)
 *   normalizedScore = min-max de rawScore dentro do pool
 *   finalWeight     = clamp(1 + k * (2 * normalizedScore - 1), min, max)
 *
 * Se todos os valores de um indicador forem iguais, ele vale `neutralScore`.
 */
import {
  weightIntensityFactors,
  weightStrategies,
  weightsConfig,
  type WeightCoefficients,
  type WeightIntensity,
  type WeightStrategyId,
} from "@/config/weights.config";

/** Indicadores brutos por dezena, exatamente como o banco agrega. */
export interface RawNumberStatistics {
  number: number;
  totalOccurrences: number;
  recentOccurrences: number;
  drawsSinceLastAppearance: number;
}

/** Recorte histórico usado (mesma fonte que alimentará a página de Estatísticas). */
export interface StatisticsSnapshot {
  lotterySlug: string;
  /** Concursos considerados no recorte (respeita a referência temporal). */
  contestsAnalyzed: number;
  /** Tamanho real da janela recente (pode ser menor que o solicitado). */
  windowContests: number;
  /** Janela pedida; null = todo o histórico. */
  requestedWindow: number | null;
  lastContestConsidered: number | null;
  firstContestConsidered: number | null;
  numbers: RawNumberStatistics[];
}

export interface NumberStatistics extends RawNumberStatistics {
  historicalFrequency: number;
  recentFrequency: number;
  normalizedHistoricalFrequency: number;
  normalizedRecentFrequency: number;
  normalizedDelay: number;
}

export interface NumberWeight {
  number: number;
  rawScore: number;
  normalizedScore: number;
  finalWeight: number;
  statistics: NumberStatistics;
}

export interface WeightSelection {
  strategyId: WeightStrategyId;
  /** Janela em concursos; null = todo o histórico. */
  window: number | null;
  intensity: WeightIntensity;
  /** Percentuais 0–100 do modo Personalizado (soma obrigatória = 100). */
  custom: { recent: number; historical: number; delay: number };
}

export interface WeightSelectionIssue {
  field: "strategy" | "window" | "intensity" | "custom";
  message: string;
}

/** Snapshot completo salvo junto do jogo — independe do preset atual. */
export interface StrategySnapshot {
  version: number;
  strategyId: WeightStrategyId;
  strategyLabel: string;
  intensity: WeightIntensity;
  intensityFactor: number;
  window: number | null;
  coefficients: WeightCoefficients;
  bounds: { minWeight: number; maxWeight: number; maxWeightRatio: number };
  statisticalReference: {
    lotterySlug: string;
    contestsAnalyzed: number;
    windowContests: number;
    lastContestConsidered: number | null;
    generatedAt: string;
  };
  /** Impressão digital do vetor de pesos, para auditoria sem guardar 80 valores. */
  weightsHash: string;
}

export function defaultWeightSelection(): WeightSelection {
  return {
    strategyId: "none",
    window: weightStrategies.none.defaultWindow,
    intensity: "medium",
    custom: { recent: 40, historical: 20, delay: 40 },
  };
}

export function selectionForStrategy(
  current: WeightSelection,
  strategyId: WeightStrategyId,
): WeightSelection {
  const definition = weightStrategies[strategyId];
  return {
    ...current,
    strategyId,
    window: definition.windowConfigurable ? (current.window ?? definition.defaultWindow) : definition.defaultWindow,
  };
}

/** Coeficientes efetivos, já normalizados para somar 1. */
export function resolveCoefficients(selection: WeightSelection): WeightCoefficients | null {
  const definition = weightStrategies[selection.strategyId];
  if (!definition.coefficients) return null;
  const raw =
    selection.strategyId === "custom"
      ? {
          recent: selection.custom.recent / 100,
          historical: selection.custom.historical / 100,
          delay: selection.custom.delay / 100,
        }
      : definition.coefficients;
  const total = raw.recent + raw.historical + raw.delay;
  if (!(total > 0)) return null;
  return {
    recent: raw.recent / total,
    historical: raw.historical / total,
    delay: raw.delay / total,
  };
}

export function validateWeightSelection(selection: WeightSelection): WeightSelectionIssue[] {
  const issues: WeightSelectionIssue[] = [];
  if (!weightStrategies[selection.strategyId]) {
    issues.push({ field: "strategy", message: "Estratégia de geração desconhecida." });
    return issues;
  }
  if (selection.window !== null && (!Number.isInteger(selection.window) || selection.window < 1)) {
    issues.push({ field: "window", message: "Período analisado inválido." });
  }
  if (!(selection.intensity in weightIntensityFactors)) {
    issues.push({ field: "intensity", message: "Influência inválida." });
  }
  if (selection.strategyId === "custom") {
    const values = [selection.custom.recent, selection.custom.historical, selection.custom.delay];
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      issues.push({ field: "custom", message: "Cada indicador deve ficar entre 0% e 100%." });
    } else if (Math.round(values[0]! + values[1]! + values[2]!) !== 100) {
      issues.push({ field: "custom", message: "A soma dos indicadores precisa ser 100%." });
    }
  }
  return issues;
}

function minMax(values: number[]) {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

function normalize(value: number, min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min <= 0) {
    return weightsConfig.neutralScore;
  }
  const result = (value - min) / (max - min);
  return Math.min(1, Math.max(0, result));
}

/** Percentil simples (interpolação pelo índice inferior), usado no cap do atraso. */
function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[index]!;
}

/**
 * Perfil estatístico por dezena, restrito ao pool elegível quando informado.
 * Dezenas excluídas não entram na normalização (não influenciam a escala).
 */
export function computeNumberStatistics(
  snapshot: StatisticsSnapshot,
  pool?: number[] | null,
): NumberStatistics[] {
  const allowed = pool && pool.length ? new Set(pool) : null;
  const rows = snapshot.numbers.filter((row) => !allowed || allowed.has(row.number));
  const contests = Math.max(1, snapshot.contestsAnalyzed);
  const windowSize = Math.max(1, snapshot.windowContests || snapshot.contestsAnalyzed);

  const historical = rows.map((row) => row.totalOccurrences / contests);
  const recent = rows.map((row) => row.recentOccurrences / windowSize);
  const delays = rows.map((row) => Math.max(0, row.drawsSinceLastAppearance));

  const historicalRange = minMax(historical);
  const recentRange = minMax(recent);
  const delayCap = Math.max(1, percentile(delays, weightsConfig.delayPercentileCap));
  const delayDenominator = Math.log1p(delayCap);

  return rows.map((row, index) => ({
    ...row,
    historicalFrequency: historical[index]!,
    recentFrequency: recent[index]!,
    normalizedHistoricalFrequency: normalize(
      historical[index]!,
      historicalRange.min,
      historicalRange.max,
    ),
    normalizedRecentFrequency: normalize(recent[index]!, recentRange.min, recentRange.max),
    normalizedDelay:
      delayDenominator > 0
        ? Math.min(1, Math.log1p(delays[index]!) / delayDenominator)
        : weightsConfig.neutralScore,
  }));
}

/** Peso final por dezena. Sempre positivo, finito e limitado. */
export function computeWeights(
  selection: WeightSelection,
  snapshot: StatisticsSnapshot,
  pool?: number[] | null,
): NumberWeight[] {
  const statistics = computeNumberStatistics(snapshot, pool);
  const coefficients = resolveCoefficients(selection);
  const intensityFactor = weightIntensityFactors[selection.intensity] ?? 0;

  if (!coefficients || intensityFactor <= 0) {
    // Modo neutro: comportamento idêntico ao gerador sem pesos.
    return statistics.map((item) => ({
      number: item.number,
      rawScore: weightsConfig.neutralScore,
      normalizedScore: weightsConfig.neutralScore,
      finalWeight: 1,
      statistics: item,
    }));
  }

  const rawScores = statistics.map(
    (item) =>
      coefficients.recent * item.normalizedRecentFrequency +
      coefficients.historical * item.normalizedHistoricalFrequency +
      coefficients.delay * item.normalizedDelay,
  );
  const scoreRange = minMax(rawScores);

  // Teto de razão entre maior e menor peso: k <= (R - 1) / (R + 1).
  const ratioCap =
    (weightsConfig.maxWeightRatio - 1) / (weightsConfig.maxWeightRatio + 1);
  const k = Math.min(intensityFactor, ratioCap);

  return statistics.map((item, index) => {
    const normalizedScore = normalize(rawScores[index]!, scoreRange.min, scoreRange.max);
    const candidate = 1 + k * (2 * normalizedScore - 1);
    const finalWeight = Math.min(
      weightsConfig.maxWeight,
      Math.max(weightsConfig.minWeight, Number.isFinite(candidate) ? candidate : 1),
    );
    return {
      number: item.number,
      rawScore: rawScores[index]!,
      normalizedScore,
      finalWeight,
      statistics: item,
    };
  });
}

/** Hash estável e curto do vetor de pesos (FNV-1a) — auditoria sem redundância. */
export function weightsHash(weights: NumberWeight[]): string {
  let hash = 0x811c9dc5;
  for (const item of weights) {
    const token = `${item.number}:${item.finalWeight.toFixed(4)};`;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
}

export function buildStrategySnapshot(
  selection: WeightSelection,
  snapshot: StatisticsSnapshot,
  weights: NumberWeight[],
  now: () => Date = () => new Date(),
): StrategySnapshot | null {
  const coefficients = resolveCoefficients(selection);
  if (selection.strategyId === "none" || !coefficients) return null;
  return {
    version: weightsConfig.strategyRulesVersion,
    strategyId: selection.strategyId,
    strategyLabel: weightStrategies[selection.strategyId].label,
    intensity: selection.intensity,
    intensityFactor: weightIntensityFactors[selection.intensity],
    window: selection.window,
    coefficients,
    bounds: {
      minWeight: weightsConfig.minWeight,
      maxWeight: weightsConfig.maxWeight,
      maxWeightRatio: weightsConfig.maxWeightRatio,
    },
    statisticalReference: {
      lotterySlug: snapshot.lotterySlug,
      contestsAnalyzed: snapshot.contestsAnalyzed,
      windowContests: snapshot.windowContests,
      lastContestConsidered: snapshot.lastContestConsidered,
      generatedAt: now().toISOString(),
    },
    weightsHash: weightsHash(weights),
  };
}

/** Sanitização do snapshot lido do banco (nunca confiar em jsonb arbitrário). */
export function sanitizeStrategySnapshot(input: unknown): StrategySnapshot | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const strategyId = raw["strategyId"];
  if (typeof strategyId !== "string" || !(strategyId in weightStrategies)) return null;
  if (strategyId === "none") return null;
  const intensity = raw["intensity"];
  const reference = (raw["statisticalReference"] ?? {}) as Record<string, unknown>;
  const coefficients = (raw["coefficients"] ?? {}) as Record<string, unknown>;
  const num = (value: unknown, fallback = 0) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return {
    version: num(raw["version"], 1),
    strategyId: strategyId as WeightStrategyId,
    strategyLabel:
      typeof raw["strategyLabel"] === "string"
        ? raw["strategyLabel"]
        : weightStrategies[strategyId as WeightStrategyId].label,
    intensity:
      intensity === "low" || intensity === "medium" || intensity === "high" ? intensity : "medium",
    intensityFactor: num(raw["intensityFactor"], 0),
    window: typeof raw["window"] === "number" ? raw["window"] : null,
    coefficients: {
      recent: num(coefficients["recent"]),
      historical: num(coefficients["historical"]),
      delay: num(coefficients["delay"]),
    },
    bounds: {
      minWeight: weightsConfig.minWeight,
      maxWeight: weightsConfig.maxWeight,
      maxWeightRatio: weightsConfig.maxWeightRatio,
    },
    statisticalReference: {
      lotterySlug: typeof reference["lotterySlug"] === "string" ? reference["lotterySlug"] : "",
      contestsAnalyzed: num(reference["contestsAnalyzed"]),
      windowContests: num(reference["windowContests"]),
      lastContestConsidered:
        typeof reference["lastContestConsidered"] === "number"
          ? reference["lastContestConsidered"]
          : null,
      generatedAt: typeof reference["generatedAt"] === "string" ? reference["generatedAt"] : "",
    },
    weightsHash: typeof raw["weightsHash"] === "string" ? raw["weightsHash"] : "",
  };
}
