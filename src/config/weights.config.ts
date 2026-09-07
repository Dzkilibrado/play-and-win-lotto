/**
 * Parâmetros da ponderação estatística ("Pesos Inteligentes").
 *
 * TODOS os coeficientes, janelas e limites vivem aqui — nenhum número mágico
 * espalhado por componentes ou pelo motor.
 *
 * Importante: pesos NÃO preveem sorteios. Eles apenas alteram a preferência de
 * seleção do gerador. Nenhum peso pode zerar uma dezena válida.
 */

export type WeightStrategyId =
  | "none"
  | "balanced"
  | "recent_frequency"
  | "delayed"
  | "historical_frequency"
  | "hybrid"
  | "custom";

export type WeightIntensity = "low" | "medium" | "high";

/** Componentes normalizados que compõem o score de uma dezena. */
export interface WeightCoefficients {
  /** Frequência na janela recente escolhida. */
  recent: number;
  /** Frequência em todo o histórico considerado. */
  historical: number;
  /** Concursos sem aparecer (atraso). */
  delay: number;
}

export interface WeightStrategyDefinition {
  id: WeightStrategyId;
  label: string;
  /** Descrição simples, sem linguagem de previsão. */
  description: string;
  coefficients: WeightCoefficients | null;
  /** Janela padrão em concursos; null = todo o histórico. */
  defaultWindow: number | null;
  /** Se a janela é editável pelo usuário nesta estratégia. */
  windowConfigurable: boolean;
  /** Aviso conceitual específico da estratégia. */
  notice?: string;
}

/** Janelas disponíveis (null = todos os concursos da modalidade). */
export const weightWindows: (number | null)[] = [10, 20, 50, 100, null];

export function windowLabel(value: number | null): string {
  return value === null ? "Todos os concursos" : `Últimos ${value} concursos`;
}

export const weightStrategies: Record<WeightStrategyId, WeightStrategyDefinition> = {
  none: {
    id: "none",
    label: "Sem pesos (aleatório)",
    description: "Todas as dezenas disponíveis têm a mesma preferência de seleção.",
    coefficients: null,
    defaultWindow: null,
    windowConfigurable: false,
  },
  balanced: {
    id: "balanced",
    label: "Equilibrado",
    description: "Combina diferentes indicadores históricos com influência moderada.",
    coefficients: { recent: 0.35, historical: 0.35, delay: 0.3 },
    defaultWindow: 50,
    windowConfigurable: true,
  },
  recent_frequency: {
    id: "recent_frequency",
    label: "Frequência recente",
    description: "Favorece dezenas mais presentes no período escolhido.",
    coefficients: { recent: 1, historical: 0, delay: 0 },
    defaultWindow: 50,
    windowConfigurable: true,
  },
  delayed: {
    id: "delayed",
    label: "Mais atrasados",
    description: "Favorece dezenas que estão há mais concursos sem aparecer.",
    coefficients: { recent: 0, historical: 0, delay: 1 },
    defaultWindow: null,
    windowConfigurable: false,
    notice: "O atraso histórico não torna uma dezena mais provável no próximo sorteio.",
  },
  historical_frequency: {
    id: "historical_frequency",
    label: "Frequência histórica",
    description: "Favorece dezenas mais presentes em todo o histórico da modalidade.",
    coefficients: { recent: 0, historical: 1, delay: 0 },
    defaultWindow: null,
    windowConfigurable: false,
  },
  hybrid: {
    id: "hybrid",
    label: "Híbrido",
    description: "Usa período recente, histórico completo e atraso, com peso maior no recente.",
    coefficients: { recent: 0.5, historical: 0.2, delay: 0.3 },
    defaultWindow: 50,
    windowConfigurable: true,
  },
  custom: {
    id: "custom",
    label: "Personalizado",
    description: "Você define quanto cada indicador influencia a geração.",
    coefficients: { recent: 0.4, historical: 0.2, delay: 0.4 },
    defaultWindow: 50,
    windowConfigurable: true,
  },
};

export const weightStrategyIds = Object.keys(weightStrategies) as WeightStrategyId[];

/**
 * Intensidade k da fórmula `peso = 1 + k * (2 * scoreNormalizado - 1)`.
 *
 * Com score em [0, 1], a razão entre o maior e o menor peso é (1+k)/(1-k).
 * O teto configurado (`maxWeightRatio`) define o k máximo permitido:
 * k <= (R - 1) / (R + 1). Com R = 6 → k <= 0,714; por isso "alta" é 0,7.
 */
export const weightIntensityFactors: Record<WeightIntensity, number> = {
  low: 0.2,
  medium: 0.45,
  high: 0.7,
};

export const weightIntensityLabels: Record<WeightIntensity, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const weightsConfig = {
  /** Piso positivo: nenhuma dezena válida vira impossível. */
  minWeight: 0.15,
  /** Teto finito: evita que uma dezena domine a seleção. */
  maxWeight: 3,
  /** Razão máxima admitida entre o maior e o menor peso. */
  maxWeightRatio: 6,
  /**
   * Normalização robusta do atraso: log1p(atraso) / log1p(cap), com o cap no
   * percentil configurado. Impede que uma dezena muito atrasada domine o score.
   */
  delayPercentileCap: 0.9,
  /** Score neutro quando todos os valores de um indicador são iguais. */
  neutralScore: 0.5,
  /** Versão do motor de pesos, guardada no snapshot de cada jogo. */
  strategyRulesVersion: 1,
  /** Validade do cache de estatísticas no cliente (ms). */
  statisticsCacheTtlMs: 10 * 60 * 1000,
  /** Quantas dezenas aparecem na prévia "maior peso na geração". */
  previewSize: 6,
} as const;

export const weightsDisclaimer =
  "Os sorteios são independentes. Dados históricos e pesos apenas orientam a forma como o " +
  "aplicativo gera combinações e não aumentam a chance matemática de determinada dezena ser sorteada.";

export const weightsExplanation =
  "Pesos alteram a preferência de seleção do gerador, não a probabilidade do sorteio.";
