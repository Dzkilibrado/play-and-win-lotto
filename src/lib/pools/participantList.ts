import type { PoolParticipantRow } from "@/lib/services/poolService";
import type { PaymentStatus } from "@/types/domain";

export type PaymentFilter = "ALL" | PaymentStatus;
export type ParticipantSort = "NAME" | "QUOTAS" | "PAYMENT";

export const paymentFilters: PaymentFilter[] = [
  "ALL",
  "PAID",
  "PENDING",
  "PARTIAL",
  "OVERDUE",
  "CANCELLED",
];

const paymentOrder: Record<PaymentStatus, number> = {
  PAID: 0,
  PARTIAL: 1,
  PENDING: 2,
  OVERDUE: 3,
  CANCELLED: 4,
};

export function countPaymentStatuses(participants: PoolParticipantRow[]) {
  const counts: Record<PaymentStatus, number> = {
    PAID: 0,
    PENDING: 0,
    PARTIAL: 0,
    OVERDUE: 0,
    CANCELLED: 0,
  };
  for (const participant of participants) counts[participant.payment_status] += 1;
  return counts;
}

export function filterAndSortParticipants(
  participants: PoolParticipantRow[],
  query: string,
  paymentFilter: PaymentFilter,
  sort: ParticipantSort,
) {
  const term = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

  return [...participants]
    .filter((participant) => paymentFilter === "ALL" || participant.payment_status === paymentFilter)
    .filter((participant) => {
      const name = participant.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");
      return !term || name.includes(term);
    })
    .sort((a, b) => {
      if (sort === "QUOTAS") return b.quotas - a.quotas || a.name.localeCompare(b.name, "pt-BR");
      if (sort === "PAYMENT") {
        return paymentOrder[a.payment_status] - paymentOrder[b.payment_status] || a.name.localeCompare(b.name, "pt-BR");
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });
}