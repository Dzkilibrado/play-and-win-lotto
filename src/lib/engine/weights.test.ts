import { describe, expect, it } from "vitest";

import { weightsConfig } from "@/config/weights.config";
import {
  buildStrategySnapshot,
  computeNumberStatistics,
  computeWeights,
  defaultWeightSelection,
  resolveCoefficients,
  sanitizeStrategySnapshot,
  selectionForStrategy,
  validateWeightSelection,
  weightsHash,
  type StatisticsSnapshot,
  type WeightSelection,
} from "./weights";
import { weightedSampleWithoutReplacement } from "./random";
import { generateGames } from "./generator";
import { defaultFilterStates } from "./filters";
import type { RandomSource } from "./random";

/** Fonte determinística: sequência fixa, sem Math.random. */
function seededRandom(seed = 123456789): RandomSource {
  let state = seed >>> 0;
  return {
    nextUint32() {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state;
    },
  } as RandomSource;
}

function snapshot(
  numbers: { number: number; total: number; recent: number; delay: number }[],
  overrides: Partial<StatisticsSnapshot> = {},
): StatisticsSnapshot {
  return {
    lotterySlug: "mega-sena",
    contestsAnalyzed: 100,
    windowContests: 20,
    requestedWindow: 20,
    lastContestConsidered: 100,
    firstContestConsidered: 1,
    numbers: numbers.map((item) => ({
      number: item.number,
      totalOccurrences: item.total,
      recentOccurrences: item.recent,
      drawsSinceLastAppearance: item.delay,
    })),
    ...overrides,
  };
}

const base = snapshot([
  { number: 1, total: 60, recent: 12, delay: 0 },
  { number: 2, total: 30, recent: 6, delay: 5 },
  { number: 3, total: 10, recent: 1, delay: 40 },
  { number: 4, total: 45, recent: 9, delay: 2 },
  { number: 5, total: 5, recent: 0, delay: 80 },
]);

function selection(partial: Partial<WeightSelection>): WeightSelection {
  return { ...defaultWeightSelection(), ...partial };
}

describe("modo neutro", () => {
  it("não pondera: todos os pesos iguais a 1", () => {
    const weights = computeWeights(selection({ strategyId: "none" }), base);
    expect(weights.every((item) => item.finalWeight === 1)).toBe(true);
  });

  it("não gera snapshot de estratégia", () => {
    const weights = computeWeights(selection({ strategyId: "none" }), base);
    expect(buildStrategySnapshot(selection({ strategyId: "none" }), base, weights)).toBeNull();
  });
});

describe("estratégias", () => {
  it("frequência recente favorece quem mais saiu na janela", () => {
    const weights = computeWeights(
      selection({ strategyId: "recent_frequency", window: 20 }),
      base,
    );
    const byNumber = new Map(weights.map((item) => [item.number, item.finalWeight]));
    expect(byNumber.get(1)!).toBeGreaterThan(byNumber.get(5)!);
  });

  it("mais atrasados favorece quem está há mais tempo sem sair", () => {
    const weights = computeWeights(selection({ strategyId: "delayed" }), base);
    const byNumber = new Map(weights.map((item) => [item.number, item.finalWeight]));
    expect(byNumber.get(5)!).toBeGreaterThan(byNumber.get(1)!);
  });

  it("frequência histórica e recente ordenam de formas diferentes", () => {
    const divergent = snapshot([
      { number: 1, total: 90, recent: 0, delay: 30 },
      { number: 2, total: 5, recent: 15, delay: 0 },
    ]);
    const historical = computeWeights(selection({ strategyId: "historical_frequency" }), divergent);
    const recent = computeWeights(selection({ strategyId: "recent_frequency" }), divergent);
    expect(historical[0]!.finalWeight).toBeGreaterThan(historical[1]!.finalWeight);
    expect(recent[0]!.finalWeight).toBeLessThan(recent[1]!.finalWeight);
  });

  it("híbrido fica entre os extremos das estratégias puras", () => {
    const hybrid = computeWeights(selection({ strategyId: "hybrid" }), base);
    const pure = computeWeights(selection({ strategyId: "delayed" }), base);
    const spread = (list: { finalWeight: number }[]) =>
      Math.max(...list.map((i) => i.finalWeight)) - Math.min(...list.map((i) => i.finalWeight));
    expect(spread(hybrid)).toBeLessThanOrEqual(spread(pure) + 1e-9);
  });

  it("personalizado com 100% de atraso equivale à estratégia de atraso", () => {
    const custom = computeWeights(
      selection({ strategyId: "custom", custom: { recent: 0, historical: 0, delay: 100 } }),
      base,
    );
    const delayed = computeWeights(selection({ strategyId: "delayed" }), base);
    custom.forEach((item, index) => {
      expect(item.finalWeight).toBeCloseTo(delayed[index]!.finalWeight, 10);
    });
  });

  it("coeficientes sempre somam 1", () => {
    const coefficients = resolveCoefficients(
      selection({ strategyId: "custom", custom: { recent: 50, historical: 30, delay: 20 } }),
    )!;
    expect(coefficients.recent + coefficients.historical + coefficients.delay).toBeCloseTo(1, 12);
  });
});

describe("limites e validação", () => {
  it("nenhum peso é zero, negativo, NaN ou acima do teto", () => {
    for (const id of ["balanced", "recent_frequency", "delayed", "hybrid"] as const) {
      for (const intensity of ["low", "medium", "high"] as const) {
        const weights = computeWeights(selection({ strategyId: id, intensity }), base);
        for (const item of weights) {
          expect(Number.isFinite(item.finalWeight)).toBe(true);
          expect(item.finalWeight).toBeGreaterThanOrEqual(weightsConfig.minWeight);
          expect(item.finalWeight).toBeLessThanOrEqual(weightsConfig.maxWeight);
        }
      }
    }
  });

  it("respeita o teto de razão entre maior e menor peso", () => {
    const weights = computeWeights(selection({ strategyId: "delayed", intensity: "high" }), base);
    const values = weights.map((item) => item.finalWeight);
    expect(Math.max(...values) / Math.min(...values)).toBeLessThanOrEqual(
      weightsConfig.maxWeightRatio + 1e-9,
    );
  });

  it("influência maior aumenta a diferença entre as dezenas", () => {
    const spread = (intensity: "low" | "medium" | "high") => {
      const values = computeWeights(
        selection({ strategyId: "delayed", intensity }),
        base,
      ).map((item) => item.finalWeight);
      return Math.max(...values) - Math.min(...values);
    };
    expect(spread("low")).toBeLessThan(spread("medium"));
    expect(spread("medium")).toBeLessThan(spread("high"));
  });

  it("indicadores personalizados fora de faixa ou fora de 100% são recusados", () => {
    expect(
      validateWeightSelection(
        selection({ strategyId: "custom", custom: { recent: 50, historical: 20, delay: 20 } }),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      validateWeightSelection(
        selection({ strategyId: "custom", custom: { recent: 120, historical: 0, delay: 0 } }),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      validateWeightSelection(
        selection({ strategyId: "custom", custom: { recent: 40, historical: 30, delay: 30 } }),
      ),
    ).toEqual([]);
  });

  it("dados degenerados (todos iguais) não quebram a normalização", () => {
    const flat = snapshot([
      { number: 1, total: 10, recent: 2, delay: 3 },
      { number: 2, total: 10, recent: 2, delay: 3 },
    ]);
    const weights = computeWeights(selection({ strategyId: "hybrid" }), flat);
    expect(weights.every((item) => item.finalWeight > 0)).toBe(true);
    expect(weights[0]!.finalWeight).toBeCloseTo(weights[1]!.finalWeight, 12);
  });

  it("restringe o perfil ao pool elegível", () => {
    const statistics = computeNumberStatistics(base, [1, 2, 3]);
    expect(statistics.map((item) => item.number)).toEqual([1, 2, 3]);
  });

  it("selectionForStrategy preserva a janela quando a estratégia permite", () => {
    const next = selectionForStrategy(selection({ window: 50 }), "recent_frequency");
    expect(next.window).toBe(50);
    expect(selectionForStrategy(next, "historical_frequency").window).toBeNull();
  });
});

describe("amostragem ponderada", () => {
  it("nunca repete dezenas", () => {
    const random = seededRandom();
    for (let round = 0; round < 200; round += 1) {
      const chosen = weightedSampleWithoutReplacement(
        [1, 2, 3, 4, 5, 6, 7, 8],
        (value) => value,
        4,
        random,
      );
      expect(new Set(chosen).size).toBe(4);
    }
  });

  it("dezenas com peso maior aparecem com mais frequência", () => {
    const random = seededRandom(42);
    const counts = new Map<number, number>();
    for (let round = 0; round < 4000; round += 1) {
      for (const value of weightedSampleWithoutReplacement(
        [1, 2],
        (value) => (value === 1 ? 3 : 1),
        1,
        random,
      )) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    expect(counts.get(1)!).toBeGreaterThan(counts.get(2)! * 2);
  });

  it("o piso de peso mantém toda dezena elegível", () => {
    const random = seededRandom(7);
    const seen = new Set<number>();
    for (let round = 0; round < 3000; round += 1) {
      for (const value of weightedSampleWithoutReplacement(
        [1, 2, 3],
        (value) => (value === 3 ? 0 : 10),
        2,
        random,
        // Piso explícito: mesmo com indicador zerado a dezena continua no sorteio.
        0.5,
      )) {
        seen.add(value);
      }
    }
    expect(seen.has(3)).toBe(true);
    // E a camada de pesos nunca produz zero, por construção.
    expect(
      computeWeights(selection({ strategyId: "delayed", intensity: "high" }), base).every(
        (item) => item.finalWeight >= weightsConfig.minWeight,
      ),
    ).toBe(true);
  });

  it("é reproduzível com a mesma fonte determinística", () => {
    const draw = () =>
      weightedSampleWithoutReplacement([1, 2, 3, 4, 5], (value) => value, 3, seededRandom(99));
    expect(draw()).toEqual(draw());
  });
});

describe("pesos com o gerador", () => {
  const weightVectorFor = (strategyId: WeightSelection["strategyId"]) => {
    const weights = computeWeights(selection({ strategyId }), base);
    return {
      strategyId,
      intensity: "medium" as const,
      window: 20 as number | null,
      contestsAnalyzed: base.contestsAnalyzed,
      lastContestConsidered: base.lastContestConsidered,
      numbers: weights.map((item) => item.number),
      values: weights.map((item) => item.finalWeight),
    };
  };

  it("pesos não violam filtros, fixas nem excluídas", () => {
    const filters = defaultFilterStates();
    filters.parity = { enabled: true, config: { min: 2, max: 4 } };
    const outcome = generateGames(
      {
        lotterySlug: "mega-sena",
        numbersCount: 6,
        gamesCount: 25,
        fixed: [7],
        excluded: [1, 2, 3],
        filters,
        previousDraw: null,
        weights: {
          ...weightVectorFor("delayed"),
          numbers: [4, 5, 6, 8, 9, 10],
          values: [3, 2.5, 2, 1.5, 1, 0.5],
        },
      },
      { random: seededRandom(2024) },
    );
    expect(outcome.games.length).toBe(25);
    for (const game of outcome.games) {
      expect(game.numbers).toContain(7);
      expect(game.numbers.some((value) => [1, 2, 3].includes(value))).toBe(false);
      const even = game.numbers.filter((value) => value % 2 === 0).length;
      expect(even).toBeGreaterThanOrEqual(2);
      expect(even).toBeLessThanOrEqual(4);
    }
  });

  it("registra a estratégia nas métricas", () => {
    const outcome = generateGames(
      {
        lotterySlug: "quina",
        numbersCount: 5,
        gamesCount: 5,
        fixed: [],
        excluded: [],
        filters: defaultFilterStates(),
        previousDraw: null,
        weights: weightVectorFor("hybrid"),
      },
      { random: seededRandom(11) },
    );
    expect(outcome.metrics.weights?.strategyId).toBe("hybrid");
    expect(outcome.metrics.weights?.contestsAnalyzed).toBe(100);
  });

  it("funciona nas três modalidades", () => {
    for (const [slug, count] of [
      ["mega-sena", 6],
      ["lotofacil", 15],
      ["quina", 5],
    ] as const) {
      const outcome = generateGames(
        {
          lotterySlug: slug,
          numbersCount: count,
          gamesCount: 10,
          fixed: [],
          excluded: [],
          filters: defaultFilterStates(),
          previousDraw: null,
          weights: weightVectorFor("balanced"),
        },
        { random: seededRandom(5) },
      );
      expect(outcome.games.length).toBe(10);
      expect(outcome.games.every((game) => game.numbers.length === count)).toBe(true);
    }
  });
});

describe("snapshot da estratégia", () => {
  const chosen = selection({ strategyId: "hybrid", window: 50, intensity: "high" });
  const weights = computeWeights(chosen, base);

  it("guarda a configuração completa sem os pesos individuais", () => {
    const saved = buildStrategySnapshot(chosen, base, weights)!;
    expect(saved.strategyId).toBe("hybrid");
    expect(saved.window).toBe(50);
    expect(saved.intensity).toBe("high");
    expect(saved.statisticalReference.lastContestConsidered).toBe(100);
    expect(saved.weightsHash).toHaveLength(8);
    expect(JSON.stringify(saved)).not.toContain("finalWeight");
  });

  it("o hash muda quando os pesos mudam", () => {
    const other = computeWeights(selection({ strategyId: "delayed" }), base);
    expect(weightsHash(weights)).not.toBe(weightsHash(other));
  });

  it("sanitiza snapshot inválido vindo do banco", () => {
    expect(sanitizeStrategySnapshot(null)).toBeNull();
    expect(sanitizeStrategySnapshot({ strategyId: "inexistente" })).toBeNull();
    const saved = buildStrategySnapshot(chosen, base, weights)!;
    expect(sanitizeStrategySnapshot(JSON.parse(JSON.stringify(saved)))?.strategyId).toBe("hybrid");
  });
});
