import { describe, expect, it } from "vitest";

import { checkGame, type OfficialTier } from "./checkEngine";
import { checkGameAcrossDraws } from "./multiDraw";
import { buildCheckPayload, evaluateGame, type DrawContext } from "./gameCheck.server";

const tiers = (values: Record<number, number | null>): OfficialTier[] =>
  Object.entries(values).map(([hits, prize]) => ({
    drawPrizeId: null,
    tier: `${hits} acertos`,
    hits: Number(hits),
    prizePerWinner: prize,
  }));

const game = [1, 2, 3, 4, 5, 6];

describe("conferência com vários sorteios", () => {
  it("com 1 sorteio devolve exatamente o resultado do motor, sem prefixo", () => {
    const draw = {
      sequence: 1,
      drawNumbers: [1, 2, 3, 4, 50, 60],
      tiers: tiers({ 6: 1000, 4: 10 }),
    };
    const result = checkGameAcrossDraws({ gameNumbers: game, baseSize: 6, draws: [draw] });
    expect(result.aggregate).toEqual(
      checkGame({
        gameNumbers: game,
        drawNumbers: draw.drawNumbers,
        baseSize: 6,
        tiers: draw.tiers,
      }),
    );
    expect(result.draws).toHaveLength(1);
  });

  it("soma os prêmios dos dois sorteios e prefixa as faixas", () => {
    const result = checkGameAcrossDraws({
      gameNumbers: game,
      baseSize: 6,
      draws: [
        { sequence: 1, drawNumbers: [1, 2, 3, 4, 50, 60], tiers: tiers({ 4: 100, 3: 10 }) },
        { sequence: 2, drawNumbers: [1, 2, 3, 40, 50, 60], tiers: tiers({ 4: 100, 3: 30 }) },
      ],
    });
    expect(result.draws.map((item) => item.outcome.hits)).toEqual([4, 3]);
    expect(result.aggregate.totalPrize).toBe(100 + 30);
    expect(result.aggregate.hits).toBe(4);
    expect(result.aggregate.isPrized).toBe(true);
    expect(result.aggregate.prizeTierHits).toBe(4);
    expect(result.aggregate.prizeLabel).toBe("1º sorteio — 4 acertos");
    expect(result.aggregate.breakdown.map((entry) => entry.tier)).toEqual([
      "1º sorteio — 4 acertos",
      "2º sorteio — 3 acertos",
    ]);
  });

  it("premia só pelo 2º sorteio quando o 1º não premia", () => {
    const result = checkGameAcrossDraws({
      gameNumbers: game,
      baseSize: 6,
      draws: [
        { sequence: 1, drawNumbers: [10, 11, 12, 13, 14, 15], tiers: tiers({ 6: 5, 3: 7 }) },
        { sequence: 2, drawNumbers: [1, 2, 3, 20, 21, 22], tiers: tiers({ 6: 5, 3: 7 }) },
      ],
    });
    expect(result.draws[0]!.outcome.isPrized).toBe(false);
    expect(result.aggregate.isPrized).toBe(true);
    expect(result.aggregate.totalPrize).toBe(7);
    expect(result.aggregate.prizeLabel).toBe("2º sorteio — 3 acertos");
  });

  it("valor pendente em um sorteio mantém a soma dos conhecidos e sinaliza pendência", () => {
    const result = checkGameAcrossDraws({
      gameNumbers: game,
      baseSize: 6,
      draws: [
        { sequence: 1, drawNumbers: [1, 2, 3, 40, 50, 60], tiers: tiers({ 3: null }) },
        { sequence: 2, drawNumbers: [1, 2, 3, 40, 50, 60], tiers: tiers({ 3: 30 }) },
      ],
    });
    expect(result.aggregate.totalPrize).toBe(30);
    expect(result.aggregate.amountPending).toBe(true);
  });

  it("sem nenhum sorteio, recusa", () => {
    expect(() => checkGameAcrossDraws({ gameNumbers: game, baseSize: 6, draws: [] })).toThrow();
  });
});

describe("payload da conferência", () => {
  const base: DrawContext = {
    drawId: "d",
    lotteryId: "l",
    slug: "dupla-sena",
    contestNumber: 10,
    drawNumbers: [1, 2, 3, 4, 50, 60],
    baseSize: 6,
    tiers: tiers({ 4: 100, 3: 10 }),
    secondDraw: null,
    secondary: null,
    sourceUpdatedAt: null,
    tiersFromOfficialSource: true,
  };

  it("modalidade de sorteio único não envia detalhe por sorteio", () => {
    const payload = buildCheckPayload(base, evaluateGame(game, base));
    expect(payload).not.toHaveProperty("draws");
    expect(payload.total_prize).toBe(100);
  });

  it("Dupla Sena envia o resultado de cada sorteio e o total somado", () => {
    const context: DrawContext = {
      ...base,
      secondDraw: { drawNumbers: [1, 2, 3, 40, 50, 60], tiers: tiers({ 4: 100, 3: 10 }) },
    };
    const payload = buildCheckPayload(context, evaluateGame(game, context));
    expect(payload.total_prize).toBe(110);
    expect(payload.draws).toEqual([
      expect.objectContaining({ draw_sequence: 1, hits: 4, total_prize: 100, is_prized: true }),
      expect.objectContaining({ draw_sequence: 2, hits: 3, total_prize: 10, is_prized: true }),
    ]);
  });
});
