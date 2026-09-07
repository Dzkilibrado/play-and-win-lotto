/**
 * Fase 3B — testes do Filter Engine.
 * Nenhum dado mockado de concurso oficial: as referências de "concurso anterior"
 * usadas aqui são valores de teste explícitos, nunca apresentados como oficiais.
 */
import { describe, expect, it } from "vitest";

import { generateGames } from "./generator";
import { validateGenerationRequest } from "./validator";
import { analyzeGame } from "./analyzer";
import { resolveRules } from "./rules";
import {
  evenCount,
  fibonacciCount,
  gridDistribution,
  maxConsecutiveRun,
  maxEqualGapStreak,
  primeCount,
  repeatedCount,
  sumTotal,
} from "./metrics";
import { seededRandomSource } from "./random";
import {
  defaultFilterStates,
  buildConstraintsSnapshot,
  sanitizeFilterStates,
  describeFilters,
  activeFilterIds,
  generationRulesVersion,
  type FilterStates,
  type PreviousDrawReference,
} from "./filters";
import type { GenerationRequest } from "./types";

const mega = resolveRules("mega-sena")!;

function states(overrides: (draft: FilterStates) => void): FilterStates {
  const draft = defaultFilterStates();
  overrides(draft);
  return draft;
}

function request(partial: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    lotterySlug: "mega-sena",
    numbersCount: 6,
    gamesCount: 10,
    fixed: [],
    excluded: [],
    ...partial,
  };
}

function run(partial: Partial<GenerationRequest> = {}, seed = 7) {
  return generateGames(request(partial), { random: seededRandomSource(seed) });
}

const previousDraw: PreviousDrawReference = {
  contestNumber: 3053,
  numbers: [4, 12, 23, 31, 45, 58],
  origin: "previous-of-selected",
};

describe("métricas compartilhadas", () => {
  it("conta consecutivos corretamente", () => {
    expect(maxConsecutiveRun([10, 11])).toBe(2);
    expect(maxConsecutiveRun([10, 11, 12])).toBe(3);
    expect(maxConsecutiveRun([20, 21, 22, 23])).toBe(4);
    expect(maxConsecutiveRun([2, 9, 17, 40])).toBe(1);
  });

  it("conta saltos iguais seguidos (regra v2: saltos, não dezenas)", () => {
    expect(maxEqualGapStreak([5, 10])).toBe(1);
    expect(maxEqualGapStreak([5, 10, 15])).toBe(2);
    expect(maxEqualGapStreak([5, 10, 15, 20])).toBe(3);
    expect(maxEqualGapStreak([5, 10, 16, 21])).toBe(1);
    expect(maxEqualGapStreak([1, 3, 5, 8, 11])).toBe(2);
    expect(maxEqualGapStreak([5, 10, 15, 30])).toBe(2);
    expect(maxEqualGapStreak([3, 6, 9, 12, 20, 30])).toBe(3);
    expect(maxEqualGapStreak([7])).toBe(0);
  });

  it("Analyzer e Filter Engine reportam o mesmo número de saltos", () => {
    for (const numbers of [
      [5, 10, 15, 20],
      [1, 3, 5, 8, 11, 30],
      [2, 9, 17, 40, 41, 55],
    ]) {
      expect(analyzeGame(numbers, mega).maxEqualGapStreak).toBe(maxEqualGapStreak(numbers));
    }
  });

  it("Fibonacci segue a definição única do sistema", () => {
    expect(fibonacciCount([1, 2, 3, 5, 8, 13], 60)).toBe(6);
    expect(fibonacciCount([21, 34, 55], 60)).toBe(3);
    expect(fibonacciCount([21, 34, 55], 25)).toBe(1);
    expect(fibonacciCount([4, 6, 7, 9], 60)).toBe(0);
  });

  it("primos: 1 não é primo", () => {
    expect(primeCount([1])).toBe(0);
    expect(primeCount([2, 3, 5, 7, 11])).toBe(5);
    expect(primeCount([9, 15, 21])).toBe(0);
  });

  it("Analyzer e Filter Engine usam a mesma geometria", () => {
    for (const slug of ["mega-sena", "lotofacil", "quina"]) {
      const rules = resolveRules(slug)!;
      const numbers = [rules.universe.min, rules.universe.min + 1, rules.universe.max];
      const analysis = analyzeGame(numbers, rules);
      const distribution = gridDistribution(numbers, rules);
      expect(analysis.rowDistribution).toEqual(distribution.rows);
      expect(analysis.columnDistribution).toEqual(distribution.columns);
    }
  });
});

describe("sem filtros", () => {
  it("mantém o comportamento do gerador básico", () => {
    const outcome = run({ gamesCount: 10 });
    expect(outcome.validation.ok).toBe(true);
    expect(outcome.games).toHaveLength(10);
    expect(outcome.partial).toBe(false);
    expect(outcome.metrics.activeFilters).toBe(0);
    expect(new Set(outcome.games.map((game) => game.key)).size).toBe(10);
  });
});

describe("filtro de paridade", () => {
  it("aceita exatamente 3 pares", () => {
    const outcome = run({
      gamesCount: 20,
      filters: states((draft) => {
        draft.parity = { enabled: true, config: { min: 3, max: 3 } };
      }),
    });
    expect(outcome.games).toHaveLength(20);
    for (const game of outcome.games) expect(evenCount(game.numbers)).toBe(3);
  });

  it("respeita o intervalo 2–4 pares", () => {
    const outcome = run({
      gamesCount: 30,
      filters: states((draft) => {
        draft.parity = { enabled: true, config: { min: 2, max: 4 } };
      }),
    });
    for (const game of outcome.games) {
      expect(evenCount(game.numbers)).toBeGreaterThanOrEqual(2);
      expect(evenCount(game.numbers)).toBeLessThanOrEqual(4);
    }
  });

  it("detecta conflito com dezenas fixas antes de gerar", () => {
    const validation = validateGenerationRequest(
      request({
        fixed: [2, 4, 6, 8],
        filters: states((draft) => {
          draft.parity = { enabled: true, config: { min: null, max: 3 } };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues[0]?.message).toContain("máximo de pares");
  });
});

describe("filtro de soma", () => {
  it("mantém a soma dentro do intervalo", () => {
    const outcome = run({
      gamesCount: 25,
      filters: states((draft) => {
        draft.sum = { enabled: true, config: { min: 100, max: 180 } };
      }),
    });
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      expect(sumTotal(game.numbers)).toBeGreaterThanOrEqual(100);
      expect(sumTotal(game.numbers)).toBeLessThanOrEqual(180);
    }
  });

  it("recusa mínimo maior que máximo", () => {
    const validation = validateGenerationRequest(
      request({
        filters: states((draft) => {
          draft.sum = { enabled: true, config: { min: 200, max: 100 } };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
  });

  it("recusa faixa impossível para a modalidade", () => {
    const below = validateGenerationRequest(
      request({
        filters: states((draft) => {
          draft.sum = { enabled: true, config: { min: null, max: 10 } };
        }),
      }),
    );
    const above = validateGenerationRequest(
      request({
        filters: states((draft) => {
          draft.sum = { enabled: true, config: { min: 400, max: null } };
        }),
      }),
    );
    expect(below.ok).toBe(false);
    expect(above.ok).toBe(false);
  });
});

describe("filtros de linha e coluna", () => {
  for (const slug of ["mega-sena", "lotofacil", "quina"] as const) {
    it(`respeita o máximo por linha e por coluna na ${slug}`, () => {
      const rules = resolveRules(slug)!;
      const maxPerRow = slug === "lotofacil" ? 4 : 2;
      const maxPerColumn = slug === "lotofacil" ? 4 : 3;
      const outcome = generateGames(
        request({
          lotterySlug: slug,
          numbersCount: rules.selectable.base,
          gamesCount: 15,
          filters: states((draft) => {
            draft.rows = {
              enabled: true,
              config: { maxPerLine: maxPerRow, minOccupied: null, maxOccupied: null },
            };
            draft.columns = {
              enabled: true,
              config: { maxPerLine: maxPerColumn, minOccupied: null, maxOccupied: null },
            };
          }),
        }),
        { random: seededRandomSource(11) },
      );
      expect(outcome.validation.ok).toBe(true);
      expect(outcome.games.length).toBeGreaterThan(0);
      for (const game of outcome.games) {
        const distribution = gridDistribution(game.numbers, rules);
        expect(distribution.maxPerRow).toBeLessThanOrEqual(maxPerRow);
        expect(distribution.maxPerColumn).toBeLessThanOrEqual(maxPerColumn);
      }
    });
  }

  it("detecta capacidade impossível por linha", () => {
    const validation = validateGenerationRequest(
      request({
        lotterySlug: "lotofacil",
        numbersCount: 15,
        filters: states((draft) => {
          draft.rows = {
            enabled: true,
            config: { maxPerLine: 2, minOccupied: null, maxOccupied: null },
          };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues[0]?.message).toContain("cabem apenas");
  });
});

describe("filtro de repetidas do concurso anterior", () => {
  it("aceita exatamente 1 repetida", () => {
    const outcome = run({
      gamesCount: 15,
      previousDraw,
      filters: states((draft) => {
        draft.repeated = {
          enabled: true,
          config: { min: 1, max: 1, reference: "previous-of-selected" },
        };
      }),
    });
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      expect(repeatedCount(game.numbers, previousDraw.numbers)).toBe(1);
    }
  });

  it("aceita nenhuma repetida", () => {
    const outcome = run({
      gamesCount: 15,
      previousDraw,
      filters: states((draft) => {
        draft.repeated = {
          enabled: true,
          config: { min: 0, max: 0, reference: "previous-of-selected" },
        };
      }),
    });
    for (const game of outcome.games) {
      expect(repeatedCount(game.numbers, previousDraw.numbers)).toBe(0);
    }
  });

  it("aceita intervalo de repetidas", () => {
    const outcome = run({
      gamesCount: 15,
      previousDraw,
      filters: states((draft) => {
        draft.repeated = {
          enabled: true,
          config: { min: 1, max: 2, reference: "previous-of-selected" },
        };
      }),
    });
    for (const game of outcome.games) {
      const repeated = repeatedCount(game.numbers, previousDraw.numbers);
      expect(repeated).toBeGreaterThanOrEqual(1);
      expect(repeated).toBeLessThanOrEqual(2);
    }
  });

  it("sem concurso anterior disponível, invalida apenas este filtro", () => {
    const validation = validateGenerationRequest(
      request({
        previousDraw: null,
        filters: states((draft) => {
          draft.repeated = {
            enabled: true,
            config: { min: 1, max: 2, reference: "previous-of-selected" },
          };
          draft.parity = { enabled: true, config: { min: 3, max: 3 } };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues).toHaveLength(1);
    expect(validation.issues[0]?.filterId).toBe("repeated");
    expect(validation.issues[0]?.message).toContain("concurso anterior");
  });

  it("conflito com fixos é detectado antes de gerar", () => {
    const validation = validateGenerationRequest(
      request({
        previousDraw,
        fixed: [4, 12, 23],
        filters: states((draft) => {
          draft.repeated = {
            enabled: true,
            config: { min: null, max: 1, reference: "previous-of-selected" },
          };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues[0]?.filterId).toBe("repeated");
  });
});

describe("filtro de consecutivos", () => {
  it("máximo 2 aceita pares seguidos e recusa trincas", () => {
    const outcome = run({
      gamesCount: 25,
      filters: states((draft) => {
        draft.consecutive = { enabled: true, config: { max: 2 } };
      }),
    });
    for (const game of outcome.games) {
      expect(maxConsecutiveRun(game.numbers)).toBeLessThanOrEqual(2);
    }
  });

  it("detecta conflito com fixos consecutivos", () => {
    const validation = validateGenerationRequest(
      request({
        fixed: [10, 11, 12],
        filters: states((draft) => {
          draft.consecutive = { enabled: true, config: { max: 2 } };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues[0]?.filterId).toBe("consecutive");
  });
});

describe("filtro de saltos", () => {
  it("limita a quantidade de saltos iguais seguidos", () => {
    const outcome = run({
      gamesCount: 25,
      filters: states((draft) => {
        draft.gapRun = { enabled: true, config: { max: 2 } };
      }),
    });
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      expect(maxEqualGapStreak(game.numbers)).toBeLessThanOrEqual(2);
    }
  });

  it("com máximo 2: aceita 05,10,15 e rejeita 05,10,15,20", () => {
    const quina = resolveRules("quina")!;
    expect(quina).toBeTruthy();
    const outcome = generateGames(
      {
        lotterySlug: "quina",
        numbersCount: 5,
        gamesCount: 30,
        fixed: [5, 10, 15],
        excluded: [],
        filters: states((draft) => {
          draft.gapRun = { enabled: true, config: { max: 2 } };
        }),
      },
      { random: seededRandomSource(11) },
    );
    expect(outcome.validation.ok).toBe(true);
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      expect(game.numbers).toEqual(expect.arrayContaining([5, 10, 15]));
      expect(maxEqualGapStreak(game.numbers)).toBeLessThanOrEqual(2);
      expect(game.numbers).not.toEqual([5, 10, 15, 20, 25]);
    }
  });

  it("FIXED_CONFLICT quando as fixas já formam mais saltos iguais que o máximo", () => {
    const validation = validateGenerationRequest({
      lotterySlug: "quina",
      numbersCount: 5,
      gamesCount: 1,
      fixed: [5, 10, 15, 20, 25],
      excluded: [],
      filters: states((draft) => {
        draft.gapRun = { enabled: true, config: { max: 2 } };
      }),
    });
    expect(validation.ok).toBe(false);
    expect(validation.issues[0]?.filterId).toBe("gapRun");
  });
});

describe("conflitos com dezenas fixas em linhas e colunas", () => {
  it("linhas: fixas ultrapassam o máximo por linha", () => {
    const validation = validateGenerationRequest(
      request({
        fixed: [1, 2, 3],
        filters: states((draft) => {
          draft.rows = { enabled: true, config: { maxPerLine: 2, minOccupied: null, maxOccupied: null } };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.filterId === "rows")).toBe(true);
  });

  it("colunas: fixas ultrapassam o máximo por coluna", () => {
    const validation = validateGenerationRequest(
      request({
        fixed: [1, 11, 21],
        filters: states((draft) => {
          draft.columns = {
            enabled: true,
            config: { maxPerLine: 2, minOccupied: null, maxOccupied: null },
          };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.filterId === "columns")).toBe(true);
  });

  it("linhas ocupadas: fixas já passam do máximo de linhas ocupadas", () => {
    const validation = validateGenerationRequest(
      request({
        fixed: [1, 11, 21],
        filters: states((draft) => {
          draft.rows = { enabled: true, config: { maxPerLine: null, minOccupied: null, maxOccupied: 2 } };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.filterId === "rows")).toBe(true);
  });

  it("colunas ocupadas: mínimo maior do que o jogo consegue ocupar", () => {
    const validation = validateGenerationRequest(
      request({
        numbersCount: 6,
        filters: states((draft) => {
          draft.columns = {
            enabled: true,
            config: { maxPerLine: null, minOccupied: 8, maxOccupied: null },
          };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.filterId === "columns")).toBe(true);
  });

  it("colunas ocupadas: fixas já passam do máximo de colunas ocupadas", () => {
    const validation = validateGenerationRequest(
      request({
        fixed: [1, 2, 3],
        filters: states((draft) => {
          draft.columns = {
            enabled: true,
            config: { maxPerLine: null, minOccupied: null, maxOccupied: 2 },
          };
        }),
      }),
    );
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.filterId === "columns")).toBe(true);
  });
});

describe("consecutivos consideram as dezenas realmente disponíveis", () => {
  it("rejeita antes de gerar quando as excluídas inviabilizam a configuração", () => {
    // Sobram 1..12 na Mega-Sena; com no máximo 1 consecutivo cabem 6 dezenas.
    const excluded = Array.from({ length: 48 }, (_, index) => index + 13);
    const validation = validateGenerationRequest(
      request({
        numbersCount: 6,
        excluded,
        filters: states((draft) => {
          draft.consecutive = { enabled: true, config: { max: 1 } };
        }),
      }),
    );
    expect(validation.ok).toBe(true);

    const impossible = validateGenerationRequest(
      request({
        numbersCount: 6,
        excluded: Array.from({ length: 50 }, (_, index) => index + 11),
        filters: states((draft) => {
          draft.consecutive = { enabled: true, config: { max: 1 } };
        }),
      }),
    );
    expect(impossible.ok).toBe(false);
    expect(impossible.issues.some((issue) => issue.filterId === "consecutive")).toBe(true);
  });
});

describe("filtros de Fibonacci e primos", () => {
  it("respeita a faixa de Fibonacci", () => {
    const outcome = run({
      gamesCount: 20,
      filters: states((draft) => {
        draft.fibonacci = { enabled: true, config: { min: 1, max: 2 } };
      }),
    });
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      const count = fibonacciCount(game.numbers, mega.universe.max);
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it("respeita a faixa de primos", () => {
    const outcome = run({
      gamesCount: 20,
      filters: states((draft) => {
        draft.prime = { enabled: true, config: { min: 1, max: 3 } };
      }),
    });
    for (const game of outcome.games) {
      expect(primeCount(game.numbers)).toBeGreaterThanOrEqual(1);
      expect(primeCount(game.numbers)).toBeLessThanOrEqual(3);
    }
  });
});

describe("combinação de filtros (AND)", () => {
  it("todo jogo satisfaz simultaneamente todas as regras", () => {
    const outcome = run(
      {
        gamesCount: 20,
        previousDraw,
        filters: states((draft) => {
          draft.parity = { enabled: true, config: { min: 3, max: 3 } };
          draft.sum = { enabled: true, config: { min: 100, max: 180 } };
          draft.prime = { enabled: true, config: { min: 1, max: 3 } };
          draft.consecutive = { enabled: true, config: { max: 2 } };
        }),
      },
      21,
    );
    expect(outcome.metrics.activeFilters).toBe(4);
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      expect(evenCount(game.numbers)).toBe(3);
      expect(sumTotal(game.numbers)).toBeGreaterThanOrEqual(100);
      expect(sumTotal(game.numbers)).toBeLessThanOrEqual(180);
      expect(primeCount(game.numbers)).toBeGreaterThanOrEqual(1);
      expect(primeCount(game.numbers)).toBeLessThanOrEqual(3);
      expect(maxConsecutiveRun(game.numbers)).toBeLessThanOrEqual(2);
    }
  });
});

describe("fixos e excluídos com filtros", () => {
  it("mantém os fixos e a paridade exata", () => {
    const outcome = run({
      gamesCount: 15,
      fixed: [2, 4],
      filters: states((draft) => {
        draft.parity = { enabled: true, config: { min: 3, max: 3 } };
      }),
    });
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      expect(game.numbers).toContain(2);
      expect(game.numbers).toContain(4);
      expect(evenCount(game.numbers)).toBe(3);
    }
  });

  it("nenhuma dezena excluída aparece, mesmo com filtros ativos", () => {
    const excluded = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const outcome = run({
      gamesCount: 20,
      excluded,
      filters: states((draft) => {
        draft.parity = { enabled: true, config: { min: 2, max: 4 } };
        draft.prime = { enabled: true, config: { min: 1, max: 3 } };
      }),
    });
    expect(outcome.games.length).toBeGreaterThan(0);
    for (const game of outcome.games) {
      for (const value of excluded) expect(game.numbers).not.toContain(value);
    }
  });
});

describe("resultado parcial e limites seguros", () => {
  it("retorna os jogos encontrados sem travar nem duplicar", () => {
    const outcome = generateGames(
      request({
        gamesCount: 100,
        numbersCount: 6,
        filters: states((draft) => {
          draft.sum = { enabled: true, config: { min: 21, max: 24 } };
          draft.parity = { enabled: true, config: { min: 3, max: 3 } };
        }),
      }),
      { random: seededRandomSource(5), limits: { maxCandidatesTotal: 20_000, maxDurationMs: 2_000 } },
    );
    expect(outcome.validation.ok).toBe(true);
    expect(outcome.partial).toBe(true);
    expect(outcome.games.length).toBeLessThan(100);
    expect(new Set(outcome.games.map((game) => game.key)).size).toBe(outcome.games.length);
    expect(["attempt_limit", "time_limit", "space_exhausted"]).toContain(
      outcome.metrics.stopReason,
    );
    for (const game of outcome.games) {
      expect(sumTotal(game.numbers)).toBeLessThanOrEqual(24);
      expect(evenCount(game.numbers)).toBe(3);
    }
  });

  it("registra métricas da execução", () => {
    const outcome = run({ gamesCount: 5 });
    expect(outcome.metrics.requested).toBe(5);
    expect(outcome.metrics.generated).toBe(5);
    expect(outcome.metrics.candidatesEvaluated).toBeGreaterThanOrEqual(5);
    expect(outcome.metrics.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("snapshot e sanitização dos filtros", () => {
  it("preserva apenas os filtros realmente ativos, com versão", () => {
    const snapshot = buildConstraintsSnapshot(
      states((draft) => {
        draft.parity = { enabled: true, config: { min: 2, max: 4 } };
        draft.sum = { enabled: true, config: { min: null, max: null } };
      }),
    );
    expect(snapshot?.version).toBe(generationRulesVersion);
    expect(snapshot?.filters.parity).toEqual({ enabled: true, config: { min: 2, max: 4 } });
    expect(snapshot?.filters.sum.enabled).toBe(false);
  });

  it("sem filtros ativos não há snapshot", () => {
    expect(buildConstraintsSnapshot(defaultFilterStates())).toBeNull();
  });

  it("sanitiza payload arbitrário", () => {
    const sanitized = sanitizeFilterStates({
      parity: { enabled: true, config: { min: "9999", max: 99999 } },
      prime: { enabled: true, config: { min: 1, max: 3 } },
      hack: { enabled: true },
    });
    expect(sanitized.parity.config).toEqual({ min: null, max: null });
    expect(sanitized.prime.config).toEqual({ min: 1, max: 3 });
    expect(activeFilterIds(sanitized)).toEqual(["prime"]);
  });

  it("descreve filtros ativos para a interface", () => {
    const chips = describeFilters(
      states((draft) => {
        draft.parity = { enabled: true, config: { min: 3, max: 3 } };
        draft.sum = { enabled: true, config: { min: 100, max: 180 } };
      }),
      {
        rules: mega,
        numbersCount: 6,
        fixed: [],
        excluded: [],
        pool: [],
        previousDraw: null,
      },
    );
    expect(chips.map((chip) => chip.summary)).toEqual(["3 pares / 3 ímpares", "Soma 100–180"]);
  });
});
