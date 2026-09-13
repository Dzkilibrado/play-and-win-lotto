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
  /** Horário oficial de referência, em America/Sao_Paulo. */
  officialDrawHour: 21,
  /** Aos domingos, o sorteio oficial ocorre pela manhã. */
  sundayDrawHour: 11,
  /** O agendamento chama o orquestrador a cada 15 minutos. */
  schedulerMinutes: 15,
  /** Retentativas persistentes após o horário previsto. */
  retryBackoffMinutes: [15, 30, 60, 120] as const,
  maxRetryDelayMinutes: 120,
  /** Depois deste total, o painel destaca que a modalidade requer atenção. */
  attentionAfterAttempts: 8,
  /** Recuperação limitada para nunca transformar uma execução em reimportação histórica. */
  maxRecoveryContestsPerRun: 5,
} as const;

/** Caminho da modalidade na fonte oficial. */
export const providerPath: Record<LotterySlug, string> = {
  "mega-sena": "megasena",
  lotofacil: "lotofacil",
  quina: "quina",
};
