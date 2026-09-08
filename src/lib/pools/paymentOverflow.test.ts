/**
 * Excedente de pagamento (P1-4).
 *
 * A estrutura atual já representa o excedente sem precisar de carteira ou
 * crédito: `total_paid` guarda a soma dos pagamentos não cancelados e
 * `amount_due` é sempre recalculado a partir de cotas + ajuste. Quando o valor
 * devido cai depois de o participante já ter pago, nenhum pagamento é apagado:
 * a diferença fica explícita como excedente e o saldo devedor nunca vira
 * negativo. A situação continua derivada (`total_paid >= amount_due` ⇒ pago).
 */
import { describe, expect, it } from "vitest";

import { summarizeFinance, type FinanceParticipant } from "./poolMath";

/** Excedente = quanto o participante pagou além do que passou a dever. */
const overflow = (participant: FinanceParticipant) =>
  Math.max(Math.round((participant.totalPaid - participant.amountDue) * 100) / 100, 0);

describe("excedente de pagamento", () => {
  it("mantém o pago e reduz apenas o devido", () => {
    const before: FinanceParticipant = {
      quotas: 12,
      amountDue: 120,
      totalPaid: 120,
      paymentStatus: "PAID",
    };
    const after: FinanceParticipant = { ...before, quotas: 10, amountDue: 100 };

    expect(after.totalPaid).toBe(120);
    expect(after.amountDue).toBe(100);
    expect(overflow(before)).toBe(0);
    expect(overflow(after)).toBe(20);
  });

  it("não gera saldo devedor negativo no resumo do bolão", () => {
    const summary = summarizeFinance([
      { quotas: 10, amountDue: 100, totalPaid: 120, paymentStatus: "PAID" },
    ]);
    expect(summary.totalOutstanding).toBe(0);
    expect(summary.totalDue).toBe(100);
  });

  it("a situação continua derivada: pago quando o pago cobre o devido", () => {
    const derive = (p: FinanceParticipant) =>
      p.totalPaid >= p.amountDue && p.amountDue > 0 ? "PAID" : p.totalPaid > 0 ? "PARTIAL" : "PENDING";
    expect(derive({ quotas: 10, amountDue: 100, totalPaid: 120, paymentStatus: "PAID" })).toBe("PAID");
    expect(derive({ quotas: 10, amountDue: 100, totalPaid: 40, paymentStatus: "PARTIAL" })).toBe("PARTIAL");
  });

  it("excedente em centavos não acumula erro de arredondamento", () => {
    expect(overflow({ quotas: 1, amountDue: 33.33, totalPaid: 33.34, paymentStatus: "PAID" })).toBe(0.01);
  });
});
