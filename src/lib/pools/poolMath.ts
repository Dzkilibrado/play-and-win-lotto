/**
 * Matemática pura dos bolões: cotas, financeiro e rateio.
 *
 * O cálculo oficial do rateio acontece no banco (`pool_calculate_distribution`).
 * Estas funções replicam exatamente a mesma regra para prévia na tela e para
 * os testes — nenhum resultado exibido como confirmado vem daqui.
 */
import { poolConfig } from "@/config/pools.config";
import type { PaymentStatus } from "@/types/domain";

const SCALE = poolConfig.currencyScale;

export interface QuotaParticipant {
  id: string;
  name: string;
  quotas: number;
  eligible: boolean;
  cancelled?: boolean;
}

export interface ShareResult {
  participantId: string;
  quotas: number;
  shareAmount: number;
  roundingAdjustment: number;
}

export interface DistributionPreview {
  totalPrize: number;
  totalEligibleQuotas: number;
  valuePerQuota: number;
  remainder: number;
  shares: ShareResult[];
}

function toCents(value: number) {
  return Math.round(value * SCALE);
}

function fromCents(cents: number) {
  return cents / SCALE;
}

/**
 * Ordem determinística da sobra de centavos: mais cotas primeiro, depois nome,
 * depois identificador. A mesma ordenação usada pelo banco.
 */
function distributionOrder(a: QuotaParticipant, b: QuotaParticipant) {
  if (b.quotas !== a.quotas) return b.quotas - a.quotas;
  const byName = a.name.localeCompare(b.name, "pt-BR");
  if (byName !== 0) return byName;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function eligibleParticipants(participants: QuotaParticipant[]) {
  return participants.filter((p) => p.eligible && !p.cancelled);
}

/**
 * Divide o prêmio em centavos inteiros. A soma das partes é sempre igual ao
 * total: a sobra vira um centavo extra para os primeiros da ordem.
 */
export function calculateDistribution(
  totalPrize: number,
  participants: QuotaParticipant[],
): DistributionPreview {
  const eligible = eligibleParticipants(participants).filter((p) => p.quotas > 0);
  const totalEligibleQuotas = eligible.reduce((sum, p) => sum + p.quotas, 0);

  if (totalEligibleQuotas <= 0) {
    return {
      totalPrize,
      totalEligibleQuotas: 0,
      valuePerQuota: 0,
      remainder: 0,
      shares: [],
    };
  }

  const cents = toCents(totalPrize);
  const base = Math.floor(cents / totalEligibleQuotas);
  const remainder = cents - base * totalEligibleQuotas;

  const ordered = [...eligible].sort(distributionOrder);

  /**
   * A sobra pode ser maior que o número de participantes (acontece quando há
   * muitas cotas): distribuímos um centavo por vez, dando voltas na mesma
   * ordem, até zerar. A soma das partes fecha sempre com o total.
   */
  const extras = ordered.map(() => 0);
  for (let left = remainder, index = 0; left > 0; left -= 1, index += 1) {
    extras[index % ordered.length] = (extras[index % ordered.length] ?? 0) + 1;
  }

  const shares = ordered.map((participant, index) => {
    const extra = extras[index] ?? 0;
    return {
      participantId: participant.id,
      quotas: participant.quotas,
      shareAmount: fromCents(base * participant.quotas + extra),
      roundingAdjustment: fromCents(extra),
    };
  });

  return {
    totalPrize,
    totalEligibleQuotas,
    valuePerQuota: fromCents(base),
    remainder: fromCents(remainder),
    shares,
  };
}

export interface FinanceParticipant {
  quotas: number;
  amountDue: number;
  totalPaid: number;
  paymentStatus: PaymentStatus;
  cancelled?: boolean;
}

export interface FinanceSummary {
  participants: number;
  quotasTaken: number;
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  paid: number;
  partial: number;
  pending: number;
  overdue: number;
}

export function summarizeFinance(participants: FinanceParticipant[]): FinanceSummary {
  const active = participants.filter((p) => !p.cancelled);
  const summary: FinanceSummary = {
    participants: active.length,
    quotasTaken: 0,
    totalDue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    paid: 0,
    partial: 0,
    pending: 0,
    overdue: 0,
  };

  for (const p of active) {
    summary.quotasTaken += p.quotas;
    summary.totalDue += p.amountDue;
    summary.totalPaid += Math.min(p.totalPaid, p.amountDue);
    if (p.paymentStatus === "PAID") summary.paid += 1;
    else if (p.paymentStatus === "PARTIAL") summary.partial += 1;
    else if (p.paymentStatus === "OVERDUE") summary.overdue += 1;
    else if (p.paymentStatus === "PENDING") summary.pending += 1;
  }

  summary.totalOutstanding = Math.max(
    Math.round((summary.totalDue - summary.totalPaid) * SCALE) / SCALE,
    0,
  );
  return summary;
}

/**
 * Cotas ainda livres. `null` significa "sem limite definido": não existe
 * disponibilidade a calcular, então devolvemos `null` em vez de zero.
 */
export function remainingQuotas(totalQuotas: number | null | undefined, quotasTaken: number) {
  if (totalQuotas == null || totalQuotas <= 0) return null;
  return Math.max(totalQuotas - quotasTaken, 0);
}

export function quotaProgress(totalQuotas: number | null | undefined, quotasTaken: number) {
  if (totalQuotas == null || totalQuotas <= 0) return 0;
  return Math.min(Math.round((quotasTaken / totalQuotas) * 100), 100);
}

/** Texto do indicador de cotas, com ou sem limite definido. */
export function quotaLabel(totalQuotas: number | null | undefined, quotasTaken: number) {
  return totalQuotas == null ? `${quotasTaken}` : `${quotasTaken}/${totalQuotas}`;
}

export const noQuotaLimitLabel = "Sem limite definido";

