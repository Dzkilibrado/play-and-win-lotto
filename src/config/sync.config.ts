/**
 * Configuração central da sincronização com a fonte oficial.
 * Trocar de provedor = trocar `provider` e criar o adapter correspondente.
 */
import type { LotterySlug } from "@/config/lotteries";

export const syncConfig = {
  provider: "caixa" as const,
  /** Base configurável da API pública de loterias. */
  baseUrl:
    process.env["LOTTERY_SOURCE_BASE_URL"] ??
    "https://servicebus2.caixa.gov.br/portaldeloterias/api",
  sourceLabel: "Loterias CAIXA — API pública do Portal de Loterias",
  /** Tempo máximo por requisição à fonte. */
  timeoutMs: 15_000,
  /** Tentativas por concurso antes de registrar erro. */
  maxAttempts: 3,
  /** Concursos processados por execução de lote (item 6 da especificação). */
  batchSize: 100,
  /** Requisições simultâneas dentro de um lote. */
  concurrency: 8,
} as const;

/** Caminho da modalidade na fonte oficial. */
export const providerPath: Record<LotterySlug, string> = {
  "mega-sena": "megasena",
  lotofacil: "lotofacil",
  quina: "quina",
};
