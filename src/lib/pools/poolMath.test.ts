import { describe, expect, it } from "vitest";

import {
  calculateDistribution,
  quotaProgress,
  remainingQuotas,
  summarizeFinance,
  type QuotaParticipant,
} from "./poolMath";

const p = (id: string, name: string, quotas: number, eligible = true): QuotaParticipant => ({
  id,
  name,
  quotas,
  eligible,
});

describe("calculateDistribution", () => {
  it("divide valor exato igualmente por cota", () => {
    const result = calculateDistribution(300, [p("a", "Ana", 1), p("b", "Bia", 2)]);
    expect(result.totalEligibleQuotas).toBe(3);
    expect(result.valuePerQuota).toBe(100);
    expect(result.remainder).toBe(0);
    const total = result.shares.reduce((s, x) => s + x.shareAmount, 0);
    expect(total).toBeCloseTo(300, 2);
  });

  it("distribui a sobra de centavos sem perder nem criar dinheiro", () => {
    const result = calculateDistribution(100, [p("a", "Ana", 1), p("b", "Bia", 1), p("c", "Caio", 1)]);
    expect(result.valuePerQuota).toBe(33.33);
    expect(result.remainder).toBe(0.01);
    const total = result.shares.reduce((s, x) => s + x.shareAmount, 0);
    expect(Math.round(total * 100)).toBe(10_000);
    expect(result.shares.filter((s) => s.roundingAdjustment > 0)).toHaveLength(1);
  });

  it("é determinístico: mais cotas primeiro, depois nome", () => {
    const participants = [p("c", "Caio", 1), p("a", "Ana", 1), p("b", "Bia", 3)];
    const first = calculateDistribution(10.01, participants);
    const again = calculateDistribution(10.01, [...participants].reverse());
    expect(first.shares.map((s) => s.participantId)).toEqual(["b", "a", "c"]);
    expect(again.shares).toEqual(first.shares);
  });

  it("ignora participante retirado do rateio", () => {
    const result = calculateDistribution(100, [p("a", "Ana", 1), p("b", "Bia", 1, false)]);
    expect(result.totalEligibleQuotas).toBe(1);
    expect(result.shares).toHaveLength(1);
    expect(result.shares[0]?.shareAmount).toBe(100);
  });

  it("ignora participante cancelado", () => {
    const result = calculateDistribution(50, [
      p("a", "Ana", 1),
      { ...p("b", "Bia", 1), cancelled: true },
    ]);
    expect(result.totalEligibleQuotas).toBe(1);
  });

  it("devolve rateio vazio sem cotas elegíveis", () => {
    const result = calculateDistribution(100, [p("a", "Ana", 0)]);
    expect(result.totalEligibleQuotas).toBe(0);
    expect(result.shares).toEqual([]);
  });

  it("trata prêmio zero sem erro", () => {
    const result = calculateDistribution(0, [p("a", "Ana", 2)]);
    expect(result.valuePerQuota).toBe(0);
    expect(result.shares[0]?.shareAmount).toBe(0);
  });

  it("mantém a soma exata em valores quebrados grandes", () => {
    const participants = Array.from({ length: 7 }, (_, i) => p(`p${i}`, `Nome ${i}`, i + 1));
    const result = calculateDistribution(451_695.33, participants);
    const total = result.shares.reduce((s, x) => Math.round(s * 100 + x.shareAmount * 100) / 100, 0);
    expect(Math.round(total * 100)).toBe(Math.round(451_695.33 * 100));
  });
});

describe("summarizeFinance", () => {
  it("soma devido, pago e pendente ignorando cancelados", () => {
    const summary = summarizeFinance([
      { quotas: 2, amountDue: 20, totalPaid: 20, paymentStatus: "PAID" },
      { quotas: 1, amountDue: 10, totalPaid: 4, paymentStatus: "PARTIAL" },
      { quotas: 1, amountDue: 10, totalPaid: 0, paymentStatus: "OVERDUE" },
      { quotas: 5, amountDue: 50, totalPaid: 0, paymentStatus: "CANCELLED", cancelled: true },
    ]);
    expect(summary.participants).toBe(3);
    expect(summary.quotasTaken).toBe(4);
    expect(summary.totalDue).toBe(40);
    expect(summary.totalPaid).toBe(24);
    expect(summary.totalOutstanding).toBe(16);
    expect(summary.overdue).toBe(1);
  });

  it("nunca gera saldo negativo com pagamento acima do devido", () => {
    const summary = summarizeFinance([
      { quotas: 1, amountDue: 10, totalPaid: 30, paymentStatus: "PAID" },
    ]);
    expect(summary.totalOutstanding).toBe(0);
  });
});

describe("cotas", () => {
  it("não devolve cotas restantes negativas", () => {
    expect(remainingQuotas(10, 12)).toBe(0);
    expect(remainingQuotas(10, 4)).toBe(6);
  });

  it("limita o progresso a 100%", () => {
    expect(quotaProgress(10, 20)).toBe(100);
    expect(quotaProgress(0, 5)).toBe(0);
    expect(quotaProgress(8, 2)).toBe(25);
  });
});
