/**
 * Configuração central da aplicação.
 * Nome, identidade e flags ficam aqui — nunca hardcoded em componentes.
 */

export const appConfig = {
  technicalName: "GestordaSorte",
  name: "Gestor da Sorte",
  shortName: "Gestor da Sorte",
  domain: "www.gestordasorte.com.br",
  canonicalOrigin: "https://www.gestordasorte.com.br",
  tagline: "Organize seus jogos. Gerencie seus bolões. Acompanhe os resultados.",
  supportingLine: "Seus jogos e bolões em um só lugar.",
  description:
    "Organize seus jogos, gerencie bolões, acompanhe concursos e resultados e explore estatísticas históricas em um só lugar.",
  /** Wordmark tipográfico substituível pelo logotipo definitivo. */
  logo: {
    kind: "wordmark" as const,
  },
  locale: "pt-BR",
  currency: "BRL",
  timeZone: "America/Sao_Paulo",
  support: {
    responsibleGamingNotice:
      "Os recursos de geração e análise não aumentam a probabilidade matemática de premiação. Os sorteios são independentes.",
  },
} as const;

/** Compõe toda URL pública apresentada ao usuário a partir da origem oficial. */
export function publicAppUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${appConfig.canonicalOrigin}/`).toString();
}

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
