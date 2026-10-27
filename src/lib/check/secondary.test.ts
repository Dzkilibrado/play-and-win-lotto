import { describe, expect, it } from "vitest";

import { checkGame, type OfficialTier } from "./checkEngine";
import { buildCheckPayload, evaluateGame, type DrawContext } from "./gameCheck.server";
import { checkSecondary } from "./secondary";

const tiers = (values: Record<number, number | null>): OfficialTier[] =>
  Object.entries(values).map(([hits, prizePerWinner]) => ({
    drawPrizeId: null,
    tier: `${hits} acertos`,
    hits: Number(hits),
    prizePerWinner,
  }));

const draw = [1, 2, 3, 4, 5, 6, 7];

function main(game: number[], official: Record<number, number | null> = { 7: 1000, 4: 10 }) {
  return checkGame({ gameNumbers: game, drawNumbers: draw, baseSize: 7, tiers: tiers(official) });
}

const monthPrize = { drawPrizeId: null, prizePerWinner: 2.5 };

describe("seleção secundária (Mês da Sorte / Time do Coração)", () => {
  it("acertou só o mês: premiado mesmo sem faixa de dezenas", () => {
    const base = main([20, 21, 22, 23, 24, 25, 26]);
    expect(base.isPrized).toBe(false);

    const result = checkSecondary(base, {
      selection: ["03"],
      result: ["03"],
      label: "Mês da Sorte",
      prize: monthPrize,
    });
    expect(result.isPrized).toBe(true);
    expect(result.totalPrize).toBe(2.5);
    expect(result.prizeLabel).toBe("Mês da Sorte");
    expect(result.prizeTierHits).toBeNull();
    expect(result.hits).toBe(0);
    expect(result.breakdown).toHaveLength(1);
  });

  it("soma o mês com a faixa de dezenas e mantém a faixa de dezenas como a melhor", () => {
    const base = main([1, 2, 3, 4, 30, 31, 29]);
    const result = checkSecondary(base, {
      selection: ["03"],
      result: ["03"],
      label: "Mês da Sorte",
      prize: monthPrize,
    });
    expect(result.totalPrize).toBe(12.5);
    expect(result.prizeTierHits).toBe(4);
    expect(result.prizeLabel).toBe("4 acertos");
    expect(result.breakdown.map((entry) => entry.tier)).toEqual(["4 acertos", "Mês da Sorte"]);
  });

  it("errou o mês: o resultado das dezenas fica exatamente como estava", () => {
    const base = main([1, 2, 3, 4, 30, 31, 29]);
    const result = checkSecondary(base, {
      selection: ["05"],
      result: ["03"],
      label: "Mês da Sorte",
      prize: monthPrize,
    });
    expect(result).toBe(base);
  });

  it("jogo sem seleção secundária não concorre ao prêmio", () => {
    const base = main([20, 21, 22, 23, 24, 25, 26]);
    const result = checkSecondary(base, {
      selection: [],
      result: ["03"],
      label: "Mês da Sorte",
      prize: monthPrize,
    });
    expect(result).toBe(base);
  });

  it("valor oficial ausente vira pendente, nunca zero", () => {
    const base = main([20, 21, 22, 23, 24, 25, 26]);
    const result = checkSecondary(base, {
      selection: ["03"],
      result: ["03"],
      label: "Mês da Sorte",
      prize: null,
    });
    expect(result.isPrized).toBe(true);
    expect(result.totalPrize).toBeNull();
    expect(result.amountPending).toBe(true);
  });

  it("aposta múltipla recebe o prêmio do mês uma vez, não por combinação", () => {
    // 8 dezenas = 8 apostas simples; o mês é uma escolha única do volante.
    const base = main([1, 2, 3, 4, 5, 6, 7, 8]);
    const result = checkSecondary(base, {
      selection: ["03"],
      result: ["03"],
      label: "Mês da Sorte",
      prize: monthPrize,
    });
    const monthEntry = result.breakdown.find((entry) => entry.tier === "Mês da Sorte");
    expect(monthEntry?.winningCombinations).toBe(1);
    expect(monthEntry?.totalForTier).toBe(2.5);
  });

  it("recusa conferir quando o concurso não tem o resultado do mês", () => {
    const base = main([20, 21, 22, 23, 24, 25, 26]);
    expect(() =>
      checkSecondary(base, { selection: ["03"], result: [], label: "Mês da Sorte", prize: null }),
    ).toThrow(/Mês da Sorte/);
  });

  it("Time do Coração paga mesmo sem nenhum acerto de dezena (Timemania)", () => {
    const base = checkGame({
      gameNumbers: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
      drawNumbers: draw,
      baseSize: 10,
      tiers: tiers({ 7: 1, 3: 1 }),
    });
    expect(base.isPrized).toBe(false);
    const result = checkSecondary(base, {
      selection: ["FLAMENGO/RJ"],
      result: ["FLAMENGO/RJ"],
      label: "Time do Coração",
      prize: { drawPrizeId: null, prizePerWinner: 4 },
    });
    expect(result.isPrized).toBe(true);
    expect(result.totalPrize).toBe(4);
  });
});

describe("conferência do concurso com seleção secundária", () => {
  const context: DrawContext = {
    drawId: "d",
    lotteryId: "l",
    slug: "dia-de-sorte",
    contestNumber: 1,
    drawNumbers: draw,
    baseSize: 7,
    tiers: tiers({ 7: 1000, 4: 10 }),
    secondDraw: null,
    secondary: { label: "Mês da Sorte", result: ["03"], prize: monthPrize },
    joint: null,
    sourceUpdatedAt: null,
    tiersFromOfficialSource: true,
  };

  it("usa a seleção do jogo e grava o prêmio do mês na decomposição", () => {
    const result = evaluateGame([1, 2, 3, 4, 30, 31, 29], context, ["03"]);
    const payload = buildCheckPayload(context, result);
    expect(payload.total_prize).toBe(12.5);
    expect(payload.breakdown.map((entry) => entry.tier)).toEqual(["4 acertos", "Mês da Sorte"]);
  });

  it("modalidade sem seleção secundária não muda em nada", () => {
    const plain: DrawContext = { ...context, secondary: null };
    const result = evaluateGame([1, 2, 3, 4, 30, 31, 29], plain, ["03"]);
    expect(result.aggregate.totalPrize).toBe(10);
  });
});
