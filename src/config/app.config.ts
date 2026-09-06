/**
 * Configuração central da aplicação.
 * Nome, identidade e flags ficam aqui — nunca hardcoded em componentes.
 */

export const appConfig = {
  /** Nome provisório do produto. Trocar aqui reflete em toda a aplicação. */
  name: "Gestor de Loterias",
  shortName: "Loterias",
  tagline: "Jogos, bolões e resultados em um só lugar",
  description:
    "Organize seus jogos de loteria, acompanhe concursos e gerencie bolões com participantes, cotas e pagamentos.",
  /** Marca visual textual (substituível por logo futuramente). */
  logo: {
    kind: "monogram" as const,
    monogram: "GL",
  },
  locale: "pt-BR",
  currency: "BRL",
  timeZone: "America/Sao_Paulo",
  support: {
    responsibleGamingNotice:
      "Estatísticas históricas não garantem nem aumentam a probabilidade de um número ser sorteado. Cada sorteio é independente.",
  },
} as const;

export type FeatureStatus = "ACTIVE" | "BETA" | "MAINTENANCE" | "DISABLED";

export type FeatureKey =
  | "generator"
  | "official_sync"
  | "statistics"
  | "auto_check"
  | "pools"
  | "notifications"
  | "whatsapp_share"
  | "documents"
  | "audit";

/**
 * Valores padrão locais das feature flags.
 * A tabela `feature_flags` no banco pode sobrescrever em runtime.
 */
export const defaultFeatureFlags: Record<FeatureKey, FeatureStatus> = {
  generator: "MAINTENANCE",
  official_sync: "DISABLED",
  statistics: "MAINTENANCE",
  auto_check: "DISABLED",
  pools: "BETA",
  notifications: "DISABLED",
  whatsapp_share: "DISABLED",
  documents: "DISABLED",
  audit: "DISABLED",
};

export const featureStatusLabel: Record<FeatureStatus, string> = {
  ACTIVE: "Ativo",
  BETA: "Beta",
  MAINTENANCE: "Em construção",
  DISABLED: "Indisponível",
};

export function isFeatureUsable(status: FeatureStatus) {
  return status === "ACTIVE" || status === "BETA";
}
