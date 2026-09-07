import { describe, expect, it } from "vitest";

import { CheckError, checkGame, type OfficialTier } from "./checkEngine";

const megaTiers: OfficialTier[] = [
  { drawPrizeId: "s", tier: "Sena", hits: 6, prizePerWinner: 60_000_000 },
  { drawPrizeId: "q", tier: "Quina", hits: 5, prizePerWinner: 50_000 },
  { drawPrizeId: "d", tier: "Quadra", hits: 4, prizePerWinner: 1_000 },
];

const lotofacilTiers: OfficialTier[] = [15, 14, 13, 12, 11].map((hits) => ({
  drawPrizeId: `t${hits}`,
  tier: `${hits} acertos`,
  hits,
  prizePerWinner: hits === 15 ? 1_500_000 : hits === 14 ? 1_000 : hits === 13 ? 25 : hits === 12 ? 10 : 5,
}));

const quinaTiers: OfficialTier[] = [
  { drawPrizeId: "q5", tier: "Quina", hits: 5, prizePerWinner: 5_000_000 },
  { drawPrizeId: "q4", tier: "Quadra", hits: 4, prizePerWinner: 8_000 },
  { drawPrizeId: "q3", tier: "Terno", hits: 3, prizePerWinner: 120 },
  { drawPrizeId: "q2", tier: "Duque", hits: 2, prizePerWinner: 3 },
];

describe("conferência — acertos", () => {
  it("conta apenas as dezenas realmente sorteadas", () => {
    const result = checkGame({
      gameNumbers: [1, 2, 3, 4, 5, 6],
      drawNumbers: [4, 5, 6, 7, 8, 9],
      baseSize: 6,
      tiers: megaTiers,
    });
    expect(result.hits).toBe(3);
    expect(result.matchedNumbers).toEqual([4, 5, 6]);
    expect(result.isPrized).toBe(false);
    expect(result.totalPrize).toBeNull();
  });

  it("independe da ordem das dezenas", () => {
    const a = checkGame({
      gameNumbers: [10, 3, 55, 22, 1, 40],
      drawNumbers: [40, 1, 22, 3, 55, 10],
      baseSize: 6,
      tiers: megaTiers,
    });
    expect(a.hits).toBe(6);
    expect(a.matchedNumbers).toEqual([1, 3, 10, 22, 40, 55]);
  });
});

describe("conferência — aposta simples", () => {
  it("Mega-Sena 6 dezenas com 4 acertos gera uma quadra", () => {
    const result = checkGame({
      gameNumbers: [1, 2, 3, 4, 5, 6],
      drawNumbers: [1, 2, 3, 4, 50, 60],
      baseSize: 6,
      tiers: megaTiers,
    });
    expect(result.simpleBets).toBe(1);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0]).toMatchObject({ hitsRequired: 4, winningCombinations: 1 });
    expect(result.totalPrize).toBe(1_000);
    expect(result.prizeLabel).toBe("Quadra");
  });
});

describe("conferência — apostas com mais dezenas", () => {
  it("Mega-Sena com 8 dezenas e 6 acertos decompõe sena, quina e quadra", () => {
    const result = checkGame({
      gameNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
      drawNumbers: [1, 2, 3, 4, 5, 6],
      baseSize: 6,
      tiers: megaTiers,
    });
    expect(result.simpleBets).toBe(28);
    expect(result.breakdown.map((item) => [item.hitsRequired, item.winningCombinations])).toEqual([
      [6, 1],
      [5, 12],
      [4, 15],
    ]);
    expect(result.totalPrize).toBe(60_000_000 + 12 * 50_000 + 15 * 1_000);
  });

  it("Lotofácil com 16 dezenas e 15 acertos soma 15 e 14 acertos", () => {
    const numbers = Array.from({ length: 16 }, (_, index) => index + 1);
    const result = checkGame({
      gameNumbers: numbers,
      drawNumbers: numbers.slice(0, 15),
      baseSize: 15,
      tiers: lotofacilTiers,
    });
    expect(result.simpleBets).toBe(16);
    expect(result.breakdown.map((item) => [item.hitsRequired, item.winningCombinations])).toEqual([
      [15, 1],
      [14, 15],
    ]);
    expect(result.totalPrize).toBe(1_500_000 + 15 * 1_000);
  });

  it("Quina com 7 dezenas e 4 acertos distribui quadra, terno e duque", () => {
    const result = checkGame({
      gameNumbers: [1, 2, 3, 4, 5, 6, 7],
      drawNumbers: [1, 2, 3, 4, 80],
      baseSize: 5,
      tiers: quinaTiers,
    });
    expect(result.simpleBets).toBe(21);
    expect(result.breakdown.map((item) => [item.hitsRequired, item.winningCombinations])).toEqual([
      [4, 3],
      [3, 12],
      [2, 6],
    ]);
    expect(result.totalPrize).toBe(3 * 8_000 + 12 * 120 + 6 * 3);
  });

  it("soma das combinações por faixa nunca ultrapassa o total de apostas simples", () => {
    const result = checkGame({
      gameNumbers: Array.from({ length: 9 }, (_, index) => index + 1),
      drawNumbers: [1, 2, 3, 4, 5, 6],
      baseSize: 6,
      tiers: megaTiers,
    });
    const total = result.breakdown.reduce((sum, item) => sum + item.winningCombinations, 0);
    expect(total).toBeLessThanOrEqual(result.simpleBets);
  });
});

describe("conferência — faixas oficiais", () => {
  it("não inventa faixa ausente no resultado oficial", () => {
    const result = checkGame({
      gameNumbers: [1, 2, 3, 4, 5, 6],
      drawNumbers: [1, 2, 3, 4, 5, 60],
      baseSize: 6,
      tiers: [{ drawPrizeId: "s", tier: "Sena", hits: 6, prizePerWinner: 1 }],
    });
    expect(result.breakdown).toHaveLength(0);
    expect(result.isPrized).toBe(false);
  });

  it("marca valor pendente quando a fonte não informou o prêmio da faixa", () => {
    const result = checkGame({
      gameNumbers: [1, 2, 3, 4, 5, 6],
      drawNumbers: [1, 2, 3, 4, 5, 6],
      baseSize: 6,
      tiers: [{ drawPrizeId: null, tier: "Sena", hits: 6, prizePerWinner: null }],
    });
    expect(result.isPrized).toBe(true);
    expect(result.amountPending).toBe(true);
    expect(result.totalPrize).toBeNull();
  });

  it("soma apenas as faixas com valor conhecido e sinaliza pendência", () => {
    const result = checkGame({
      gameNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
      drawNumbers: [1, 2, 3, 4, 5, 6],
      baseSize: 6,
      tiers: [
        { drawPrizeId: "s", tier: "Sena", hits: 6, prizePerWinner: null },
        { drawPrizeId: "q", tier: "Quina", hits: 5, prizePerWinner: 100 },
        { drawPrizeId: "d", tier: "Quadra", hits: 4, prizePerWinner: 10 },
      ],
    });
    expect(result.totalPrize).toBe(12 * 100 + 15 * 10);
    expect(result.amountPending).toBe(true);
  });

  it("ignora faixa maior que a aposta simples da modalidade", () => {
    const result = checkGame({
      gameNumbers: [1, 2, 3, 4, 5, 6, 7],
      drawNumbers: [1, 2, 3, 4, 5, 6, 7],
      baseSize: 6,
      tiers: [...megaTiers, { drawPrizeId: "x", tier: "Faixa inválida", hits: 7, prizePerWinner: 9 }],
    });
    // Com 7 acertos em 7 dezenas não sobra dezena errada: só a faixa máxima existe.
    expect(result.breakdown.map((item) => item.hitsRequired)).toEqual([6]);
    expect(result.breakdown[0]?.winningCombinations).toBe(7);
  });
});

describe("conferência — dados inconsistentes", () => {
  it("recusa concurso sem dezenas oficiais", () => {
    expect(() =>
      checkGame({ gameNumbers: [1, 2, 3, 4, 5, 6], drawNumbers: [], baseSize: 6, tiers: megaTiers }),
    ).toThrowError(CheckError);
  });

  it("recusa jogo com dezenas repetidas", () => {
    expect(() =>
      checkGame({
        gameNumbers: [1, 1, 2, 3, 4, 5],
        drawNumbers: [1, 2, 3, 4, 5, 6],
        baseSize: 6,
        tiers: megaTiers,
      }),
    ).toThrowError(CheckError);
  });

  it("recusa jogo menor que a aposta simples", () => {
    expect(() =>
      checkGame({
        gameNumbers: [1, 2, 3],
        drawNumbers: [1, 2, 3, 4, 5, 6],
        baseSize: 6,
        tiers: megaTiers,
      }),
    ).toThrowError(CheckError);
  });

  it("é idempotente: mesma entrada, mesmo resultado", () => {
    const input = {
      gameNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
      drawNumbers: [1, 2, 3, 4, 5, 6],
      baseSize: 6,
      tiers: megaTiers,
    };
    expect(checkGame(input)).toEqual(checkGame(input));
  });
});
