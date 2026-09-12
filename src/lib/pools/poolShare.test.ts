import { describe, expect, it } from "vitest";

import { poolShareMessage, poolSharePreview, poolShareStats } from "./poolShare";
import type { PoolRow } from "@/lib/services/poolService";

const pool = {
  name: "Bolão Galera Gmill",
  contest_number: 3780,
  contest_number_planned: null,
  draw_date: "2026-09-15",
  draw_date_planned: null,
  lotteries: { name: "Lotofácil", slug: "lotofacil", short_name: "Lotofácil", color_key: "lotofacil" },
  pool_participants: Array.from({ length: 23 }, (_, index) => ({
    id: String(index), user_id: null, quotas: 1, amount_due: 60, total_paid: 60,
    payment_status: "PAID" as const, status: "ACTIVE" as const, eligible_for_prize_share: true,
  })),
  pool_games: Array.from({ length: 19 }, (_, index) => ({
    id: String(index), generated_games: { status: "BET" as const },
  })),
  pool_share_links: [],
} as unknown as PoolRow;

describe("mensagens reais de compartilhamento", () => {
  it("usa os números reais do bolão oficial", () => {
    expect(poolShareStats(pool)).toEqual({ participants: 23, paidQuotas: 23, linkedGames: 19, confirmedBets: 19 });
    expect(poolSharePreview(pool, "FULL")).toEqual(["Resumo + 23 participantes", "23 cotas + 19 jogos"]);
  });

  it("organiza a mensagem de jogos e mantém o link em linha própria", () => {
    const message = poolShareMessage(pool, "GAMES", "https://example.test/b/token");
    expect(message).toContain("Bolão: Bolão Galera Gmill");
    expect(message).toContain("Lotofácil · Concurso 3780");
    expect(message).toContain("19 jogos vinculados\n19 apostas confirmadas");
    expect(message.endsWith("https://example.test/b/token")).toBe(true);
  });

  it("não inventa concurso quando ele não existe", () => {
    const withoutContest = { ...pool, contest_number: null, contest_number_planned: null };
    expect(poolShareMessage(withoutContest, "PARTICIPANTS", null)).toContain("Concurso a definir");
  });
});