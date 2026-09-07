/**
 * Fase 3C.1 — caminho ponderado por enumeração de candidatos.
 *
 * Cobre: escolha do caminho, soberania dos filtros, distribuição ponderada,
 * reprodutibilidade e dados degenerados.
 */
import { describe, expect, it } from "vitest";

import { defaultFilterStates } from "./filters";
import { generateGames } from "./generator";
import { seededRandomSource } from "./random";
import type { GenerationWeights } from "./types";

/** Pesos altos para as dezenas baixas, baixos para as altas. */
function weights(numbers: number[], value: (n: number) => number): GenerationWeights {
  return {
    strategyId: "custom",
    intensity: "high",
    window: 50,
    contestsAnalyzed: 500,
    lastContestConsidered: 500,
    numbers,
    values: numbers.map(value),
  };
}

const universe = (size: number) => Array.from({ length: size }, (_, index) => index + 1);

/** Mega-Sena com 40 dezenas excluídas: C(20,6) = 38.760, dentro do limite. */
function smallSpaceRequest(overrides: Record<string, unknown> = {}) {
  const eligible = universe(20);
  return {
    lotterySlug: "mega-sena",
    numbersCount: 6,
    gamesCount: 30,
    fixed: [] as number[],
    excluded: universe(60).filter((value) => !eligible.includes(value)),
    filters: defaultFilterStates(),
    previousDraw: null,
    weights: weights(eligible, (n) => (n <= 10 ? 3 : 0.5)),
    ...overrides,
  } as Parameters<typeof generateGames>[0];
}

describe("escolha do caminho de geração", () => {
  it("espaço pequeno com pesos usa enumeração ponderada", () => {
    const outcome = generateGames(smallSpaceRequest(), { random: seededRandomSource(7) });
    expect(outcome.metrics.samplingMode).toBe("weighted_enumeration");
    expect(outcome.games).toHaveLength(30);
  });

  it("espaço grande com pesos volta para amostragem ponderada", () => {
    const eligible = universe(25);
    const outcome = generateGames(
      {
        lotterySlug: "lotofacil",
        numbersCount: 15,
        gamesCount: 20,
        fixed: [],
        excluded: [],
        filters: defaultFilterStates(),
        previousDraw: null,
        weights: weights(eligible, (n) => (n <= 12 ? 2 : 1)),
      },
      { random: seededRandomSource(9) },
    );
    expect(outcome.metrics.samplingMode).toBe("weighted_sampling");
    expect(outcome.games).toHaveLength(20);
  });

  it("sem pesos o caminho eficiente existente é mantido", () => {
    const outcome = generateGames(
      {
        lotterySlug: "quina",
        numbersCount: 5,
        gamesCount: 20,
        fixed: [],
        excluded: [],
        filters: defaultFilterStates(),
        previousDraw: null,
      },
      { random: seededRandomSource(3) },
    );
    expect(outcome.metrics.samplingMode).toMatch(/^uniform_/);
    expect(outcome.metrics.weights).toBeNull();
  });
});

describe("os filtros continuam soberanos", () => {
  it("nenhum jogo do caminho ponderado viola filtros, fixas ou excluídas", () => {
    const filters = defaultFilterStates();
    filters.parity = { enabled: true, config: { min: 3, max: 3 } };
    filters.sum = { enabled: true, config: { min: 40, max: 80 } };
    const outcome = generateGames(
      smallSpaceRequest({ filters, fixed: [2], gamesCount: 25 }),
      { random: seededRandomSource(21) },
    );
    expect(outcome.metrics.samplingMode).toBe("weighted_enumeration");
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      expect(game.numbers).toContain(2);
      expect(Math.max(...game.numbers)).toBeLessThanOrEqual(20);
      const even = game.numbers.filter((value) => value % 2 === 0).length;
      expect(even).toBe(3);
      const sum = game.numbers.reduce((total, value) => total + value, 0);
      expect(sum).toBeGreaterThanOrEqual(40);
      expect(sum).toBeLessThanOrEqual(80);
    }
  });
});

describe("distribuição ponderada", () => {
  it("dezenas com peso maior aparecem mais entre os jogos escolhidos", () => {
    const outcome = generateGames(smallSpaceRequest({ gamesCount: 100 }), {
      random: seededRandomSource(4242),
    });
    const counts = new Map<number, number>();
    for (const game of outcome.games) {
      for (const value of game.numbers) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const heavy = universe(10).reduce((total, n) => total + (counts.get(n) ?? 0), 0);
    const light = universe(20)
      .slice(10)
      .reduce((total, n) => total + (counts.get(n) ?? 0), 0);
    expect(heavy).toBeGreaterThan(light);
  });

  it("é reproduzível com a mesma fonte determinística", () => {
    const run = () =>
      generateGames(smallSpaceRequest({ gamesCount: 15 }), {
        random: seededRandomSource(555),
      }).games.map((game) => game.numbers.join("-"));
    expect(run()).toEqual(run());
  });

  it("não repete jogos", () => {
    const outcome = generateGames(smallSpaceRequest({ gamesCount: 80 }), {
      random: seededRandomSource(88),
    });
    expect(new Set(outcome.games.map((game) => game.key)).size).toBe(outcome.games.length);
  });
});

describe("dados degenerados", () => {
  it("todos os pesos iguais ainda geram a quantidade pedida", () => {
    const outcome = generateGames(
      smallSpaceRequest({ weights: weights(universe(20), () => 1) }),
      { random: seededRandomSource(12) },
    );
    expect(outcome.games).toHaveLength(30);
  });

  it("uma única dezena com peso alto não impede jogos completos e válidos", () => {
    const outcome = generateGames(
      smallSpaceRequest({ weights: weights(universe(20), (n) => (n === 1 ? 6 : 0.15)) }),
      { random: seededRandomSource(13) },
    );
    expect(outcome.games).toHaveLength(30);
    for (const game of outcome.games) expect(new Set(game.numbers).size).toBe(6);
  });

  it("pesos inválidos (zero, negativo, NaN) não quebram a geração", () => {
    const broken = weights(universe(20), (n) => (n % 3 === 0 ? 0 : n % 5 === 0 ? -2 : Number.NaN));
    const outcome = generateGames(smallSpaceRequest({ weights: broken }), {
      random: seededRandomSource(14),
    });
    expect(outcome.games).toHaveLength(30);
    expect(outcome.games.every((game) => game.numbers.length === 6)).toBe(true);
  });

  it("resultado parcial continua válido quando os filtros esgotam o espaço", () => {
    const filters = defaultFilterStates();
    filters.parity = { enabled: true, config: { min: 3, max: 3 } };
    const outcome = generateGames(
      smallSpaceRequest({
        gamesCount: 7,
        filters,
        excluded: universe(60).filter((value) => value > 7),
        weights: weights(universe(7), (n) => n),
      }),
      { random: seededRandomSource(15) },
    );
    expect(outcome.metrics.stopReason).toBe("space_exhausted");
    expect(outcome.games.length).toBeGreaterThan(0);
    expect(outcome.games.length).toBeLessThan(7);
    expect(outcome.partial).toBe(true);
    for (const game of outcome.games) {
      expect(game.numbers.filter((value) => value % 2 === 0)).toHaveLength(3);
    }
  });

});
