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
  /**
   * Relógio leve do banco. Ele só chama o aplicativo quando existe uma ação
   * vencida; não representa a frequência de consulta à fonte oficial.
   */
  schedulerMinutes: 10,
  /** Verificações de calendário em dias comuns (America/Sao_Paulo). */
  healthCheckHours: [7, 12, 17, 22] as const,
  /** Uma confirmação do calendário pouco antes do sorteio. */
  preDrawWindowMinutes: 45,
  /** Tentativas rápidas somente na primeira hora após o horário previsto. */
  postDrawIntervalMinutes: 10,
  postDrawFastWindowMinutes: 60,
  /** Depois da janela rápida, reduz progressivamente a frequência. */
  retryBackoffMinutes: [30, 60, 120] as const,
  maxRetryDelayMinutes: 120,
  /** Revisão posterior do concurso importado para detectar retificação oficial. */
  consistencyCheckDelayMinutes: 360,
  /** Atraso de publicação a partir do qual o painel pede atenção. */
  maxAlertDelayMinutes: 720,
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
