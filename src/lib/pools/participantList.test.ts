import { describe, expect, it } from "vitest";

import { countPaymentStatuses, filterAndSortParticipants } from "./participantList";
import type { PoolParticipantRow } from "@/lib/services/poolService";
import type { PaymentStatus } from "@/types/domain";

function participant(name: string, quotas: number, payment_status: PaymentStatus): PoolParticipantRow {
  return {
    id: name,
    pool_id: "pool",
    user_id: null,
    name,
    phone: null,
    quotas,
    amount_due: 0,
    amount_adjustment: 0,
    adjustment_reason: null,
    total_paid: 0,
    payment_status,
    status: "ACTIVE",
    eligible_for_prize_share: true,
    ineligible_reason: null,
    paid_at: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const rows = [
  participant("Íris", 1, "PAID"),
  participant("Bruno", 5, "PENDING"),
  participant("Ana", 2, "PARTIAL"),
  participant("Carlos", 3, "OVERDUE"),
  participant("Dora", 1, "CANCELLED"),
];

describe("lista administrativa de participantes", () => {
  it("busca nomes sem diferenciar acentos", () => {
    expect(filterAndSortParticipants(rows, "iris", "ALL", "NAME").map((row) => row.name)).toEqual(["Íris"]);
  });

  it.each(["PAID", "PENDING", "PARTIAL", "OVERDUE", "CANCELLED"] as const)("filtra o estado %s", (status) => {
    expect(filterAndSortParticipants(rows, "", status, "NAME").every((row) => row.payment_status === status)).toBe(true);
  });

  it("ordena por nome", () => {
    expect(filterAndSortParticipants(rows, "", "ALL", "NAME").map((row) => row.name)).toEqual(["Ana", "Bruno", "Carlos", "Dora", "Íris"]);
  });

  it("ordena por quantidade de cotas", () => {
    expect(filterAndSortParticipants(rows, "", "ALL", "QUOTAS").map((row) => row.quotas)).toEqual([5, 3, 2, 1, 1]);
  });

  it("ordena por situação de pagamento", () => {
    expect(filterAndSortParticipants(rows, "", "ALL", "PAYMENT").map((row) => row.payment_status)).toEqual(["PAID", "PARTIAL", "PENDING", "OVERDUE", "CANCELLED"]);
  });

  it("contabiliza todos os estados reais", () => {
    expect(countPaymentStatuses(rows)).toEqual({ PAID: 1, PENDING: 1, PARTIAL: 1, OVERDUE: 1, CANCELLED: 1 });
  });

  it.each([23, 50, 100, 200])("preserva %i linhas ao ordenar", (total) => {
    const many = Array.from({ length: total }, (_, index) => participant(`Pessoa ${index}`, (index % 5) + 1, "PAID"));
    expect(filterAndSortParticipants(many, "", "ALL", "NAME")).toHaveLength(total);
  });
});