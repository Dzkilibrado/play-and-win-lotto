import { describe, expect, it } from "vitest";

import { buildPoolReportDefinition, poolReportFileName, type PoolReportData } from "./poolReportPdf";
import type { PoolParticipantRow, PoolRow } from "@/lib/services/poolService";

const pool = {
  name: "Bolão Galera Gmill",
  contest_number: 3780,
  contest_number_planned: null,
  draw_date: "2026-09-15",
  draw_date_planned: null,
  quota_value: 60,
  total_quotas: 23,
  status: "AWAITING_DRAW",
  lotteries: { name: "Lotofácil", slug: "lotofacil", short_name: "Lotofácil", color_key: "lotofacil" },
} as unknown as PoolRow;

const participants = Array.from({ length: 23 }, (_, index) => ({
  id: String(index), pool_id: "pool", user_id: null, name: `Participante ${index + 1}`,
  phone: index === 0 ? "11999999999" : null, quotas: 1, amount_due: 60, amount_adjustment: 0,
  adjustment_reason: null, total_paid: 60, payment_status: "PAID", status: "ACTIVE",
  eligible_for_prize_share: true, ineligible_reason: null, paid_at: "2026-09-12", notes: "privado", created_at: "2026-09-12",
})) as PoolParticipantRow[];

const data: PoolReportData = {
  pool,
  participants,
  games: Array.from({ length: 19 }, (_, index) => ({
    gameId: `game-${index}`, sequence: index + 1, status: "BET", contestNumber: 3780,
    cost: index === 18 ? 29 : 75, numbers: Array.from({ length: 15 }, (_, number) => number + 1),
  })),
  checks: new Map(),
  officialPrizeTotal: 0,
  generatedAt: new Date("2026-09-12T19:52:00Z"),
};

describe("relatório PDF do bolão", () => {
  it("cria nome amigável sem identificador técnico", () => {
    expect(poolReportFileName(pool)).toBe("relatorio-bolao-galera-gmill-concurso-3780.pdf");
  });

  it("inclui o cenário real e exclui dados privados", () => {
    const definition = buildPoolReportDefinition(data);
    const serialized = JSON.stringify(definition);
    expect(serialized).toContain("Bolão Galera Gmill");
    expect(serialized).toContain("Participantes ativos");
    expect(serialized).toContain("R$ 1.380,00");
    expect(serialized).toContain("Apostado");
    expect(serialized).not.toContain("11999999999");
    expect(serialized).not.toContain("privado");
    expect(serialized).not.toContain("game-0");
  });

  it.each([10, 23, 50, 100, 200])("aceita %i participantes sem cortar dados do documento", (count) => {
    const definition = buildPoolReportDefinition({ ...data, participants: participants.slice(0, 1).flatMap((item) => Array.from({ length: count }, (_, index) => ({ ...item, id: String(index), name: `Pessoa ${index + 1}` }))) });
    expect(JSON.stringify(definition)).toContain(`Pessoa ${count}`);
  });
});