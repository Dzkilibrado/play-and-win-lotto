/**
 * Configuração central dos bolões.
 * Regras de transição, textos de responsabilidade e parâmetros de rateio
 * ficam aqui — nunca espalhados pelos componentes.
 */
import type { PaymentStatus, PoolStatus } from "@/types/domain";

export const poolConfig = {
  /** Versão do cálculo de rateio gravada em cada distribuição. */
  distributionCalculationVersion: 1,
  /** Centavos: o rateio é calculado em inteiros e a sobra é distribuída. */
  currencyScale: 100,
  /** Marcos da contagem regressiva até o sorteio (em dias). */
  countdownMilestones: [15, 10, 7, 3, 1, 0],
  pageSize: 20,
} as const;

/**
 * Transições permitidas. O banco é a autoridade (`pool_set_status`);
 * aqui apenas evitamos oferecer botões que seriam recusados.
 */
export const poolStatusTransitions: Record<PoolStatus, PoolStatus[]> = {
  FORMING: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED", "CANCELLED"],
  CLOSED: ["AWAITING_DRAW", "OPEN", "CANCELLED"],
  AWAITING_DRAW: ["AWAITING_CHECK", "CLOSED", "CANCELLED"],
  AWAITING_CHECK: ["CHECKED", "PRIZED"],
  CHECKED: ["PRIZED", "FINISHED"],
  PRIZED: ["FINISHED"],
  FINISHED: [],
  CANCELLED: [],
};

/** Situações que exigem motivo obrigatório. */
export const poolStatusRequiresReason: PoolStatus[] = ["CANCELLED"];

/** Ação em linguagem do usuário para cada destino. */
export const poolStatusAction: Record<PoolStatus, string> = {
  FORMING: "Voltar para formação",
  OPEN: "Reabrir para novos participantes",
  CLOSED: "Fechar entradas",
  AWAITING_DRAW: "Marcar como aguardando sorteio",
  AWAITING_CHECK: "Marcar como aguardando conferência",
  CHECKED: "Marcar como conferido",
  PRIZED: "Marcar como premiado",
  FINISHED: "Encerrar bolão",
  CANCELLED: "Cancelar bolão",
};

export const paymentStatusOrder: PaymentStatus[] = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

export const distributionStatusLabel = {
  CALCULATED: "Calculado",
  CONFIRMED: "Confirmado",
  OUTDATED: "Precisa recalcular",
} as const;

export const poolNotices = {
  distribution:
    "O rateio é apenas um cálculo de referência para organizar a divisão entre os participantes. Ele não substitui o pagamento oficial nem cria qualquer obrigação para a operadora da loteria.",
  distributionOutdated:
    "Algo mudou depois do último cálculo (participantes, cotas ou o resultado da conferência). Recalcule antes de confirmar.",
  publicLink:
    "O link mostra apenas nome do bolão, modalidade, concurso, situação e total de cotas. Nomes, telefones e valores individuais nunca aparecem.",
  cancelPool:
    "Cancelar preserva todo o histórico: nada é apagado, o bolão apenas deixa de aceitar mudanças.",
  overpay: "O valor informado ultrapassa o que este participante deve. Confirme para registrar mesmo assim.",
} as const;
