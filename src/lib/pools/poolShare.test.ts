import { describe, expect, it, vi } from "vitest";

import { nativeShare, poolPublicUrl, poolShareMessage, poolSharePreview, poolShareScopeDescription, poolShareStats, whatsappShareUrl } from "./poolShare";
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
    expect(poolShareStats(pool)).toEqual({ participants: 23, paidQuotas: 23, games: 19, confirmedBets: 19, plannedGames: 0 });
    expect(poolSharePreview(pool, "FULL", 1)).toEqual(["23 participantes confirmados", "23 cotas pagas", "19 jogos", "1 comprovante publicado"]);
    expect(poolShareScopeDescription.FULL).toBe("Resumo completo com participantes, jogos e comprovantes publicados.");
  });

  it("omite a linha de comprovantes quando não há publicação", () => {
    expect(poolSharePreview(pool, "FULL", 0)).toEqual(["23 participantes confirmados", "23 cotas pagas", "19 jogos"]);
  });

  it("organiza a mensagem de jogos e mantém o link em linha própria", () => {
    const message = poolShareMessage(pool, "GAMES", "https://example.test/b/token");
    expect(message).toContain("Bolão: Bolão Galera Gmill");
    expect(message).toContain("Lotofácil · Concurso 3780");
    expect(message).toContain("19 jogos · Todos apostados");
    expect(message).not.toContain("vinculad");
    expect(message.endsWith("https://example.test/b/token")).toBe(true);
  });

  it("não inventa concurso quando ele não existe", () => {
    const withoutContest = { ...pool, contest_number: null, contest_number_planned: null };
    expect(poolShareMessage(withoutContest, "PARTICIPANTS", null)).toContain("Concurso a definir");
  });

  it("distingue jogos apostados e planejados", () => {
    const mixed = { ...pool, pool_games: pool.pool_games.map((item, index) => index < 4 ? { ...item, generated_games: { status: "PLANNED" as const } } : item) };
    expect(poolSharePreview(mixed as PoolRow, "GAMES")[0]).toBe("19 jogos · 15 apostados · 4 planejados");
  });

  it.each(["PARTICIPANTS", "GAMES", "FULL"] as const)("usa o domínio oficial com WWW no escopo %s", (scope) => {
    const withLinks = {
      ...pool,
      pool_share_links: [{ scope, token: `token-${scope.toLowerCase()}`, revoked_at: null }],
    } as PoolRow;
    expect(poolPublicUrl(withLinks, scope)).toBe(`https://www.gestordasorte.com.br/b/token-${scope.toLowerCase()}`);
  });

  it("leva o mesmo endereço oficial na mensagem e no WhatsApp", () => {
    const withLink = { ...pool, pool_share_links: [{ scope: "FULL", token: "abc123", revoked_at: null }] } as PoolRow;
    const url = poolPublicUrl(withLink, "FULL");
    const message = poolShareMessage(withLink, "FULL", url);
    expect(message).toContain("https://www.gestordasorte.com.br/b/abc123");
    expect(decodeURIComponent(whatsappShareUrl(message))).toContain("https://www.gestordasorte.com.br/b/abc123");
  });

  it("entrega o endereço oficial ao compartilhamento do aparelho", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", { isSecureContext: true });
    vi.stubGlobal("navigator", { share });

    await expect(nativeShare({ title: "Bolão", text: "Confira", url: "https://www.gestordasorte.com.br/b/abc123" })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Bolão", text: "Confira", url: "https://www.gestordasorte.com.br/b/abc123" });
    vi.unstubAllGlobals();
  });
});