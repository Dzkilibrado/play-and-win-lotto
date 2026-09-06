import { describe, expect, it } from "vitest";

import { generationConfig } from "@/config/generation.config";
import {
  analyzeGame,
  canonicalKey,
  combinations,
  fibonacciSet,
  isPrime,
  resolveRules,
  seededRandomSource,
  validateGenerationRequest,
} from "./index";
import { generateGames } from "./generator";
import type { GenerationRequest } from "./types";

const random = () => seededRandomSource(20260906);

function request(partial: Partial<GenerationRequest> & { lotterySlug: string }): GenerationRequest {
  return {
    numbersCount: 6,
    gamesCount: 1,
    fixed: [],
    excluded: [],
    ...partial,
  };
}

function expectValidBatch(
  req: GenerationRequest,
  bounds: { min: number; max: number },
) {
  const { validation, games } = generateGames(req, { random: random() });
  expect(validation.ok, JSON.stringify(validation.issues)).toBe(true);
  expect(games).toHaveLength(req.gamesCount);
  const keys = new Set<string>();
  for (const game of games) {
    expect(game.numbers).toHaveLength(req.numbersCount);
    expect(new Set(game.numbers).size).toBe(req.numbersCount);
    expect(Math.min(...game.numbers)).toBeGreaterThanOrEqual(bounds.min);
    expect(Math.max(...game.numbers)).toBeLessThanOrEqual(bounds.max);
    for (const fixedNumber of req.fixed) expect(game.numbers).toContain(fixedNumber);
    for (const excludedNumber of req.excluded) expect(game.numbers).not.toContain(excludedNumber);
    expect([...game.numbers]).toEqual([...game.numbers].sort((a, b) => a - b));
    keys.add(game.key);
  }
  expect(keys.size).toBe(games.length);
  return games;
}

describe("matemática central", () => {
  it("calcula combinações sem enumerar", () => {
    expect(combinations(60, 6)).toBe(50_063_860);
    expect(combinations(25, 15)).toBe(3_268_760);
    expect(combinations(80, 5)).toBe(24_040_016);
    expect(combinations(5, 6)).toBe(0);
  });

  it("identifica primos genericamente", () => {
    expect([1, 2, 3, 4, 17, 60, 79].map(isPrime)).toEqual([
      false,
      true,
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it("usa Fibonacci positiva sem duplicar o 1", () => {
    expect([...fibonacciSet(80)]).toEqual([1, 2, 3, 5, 8, 13, 21, 34, 55]);
  });

  it("gera chave canônica independente da ordem", () => {
    expect(canonicalKey([60, 1, 43, 7, 51, 18])).toBe("01-07-18-43-51-60");
    expect(canonicalKey([1, 7, 18, 43, 51, 60])).toBe(canonicalKey([60, 51, 43, 18, 7, 1]));
  });
});

describe("game analyzer", () => {
  const mega = resolveRules("mega-sena")!;

  it("calcula pares, ímpares, soma, primos e fibonacci", () => {
    const analysis = analyzeGame([1, 7, 18, 23, 43, 56], mega);
    expect(analysis.evenCount + analysis.oddCount).toBe(6);
    expect(analysis.evenCount).toBe(2);
    expect(analysis.oddCount).toBe(4);
    expect(analysis.sumTotal).toBe(148);
    expect(analysis.primeCount).toBe(3); // 7, 23, 43
    expect(analysis.fibonacciCount).toBe(1); // 1
  });

  it("calcula maior sequência consecutiva", () => {
    expect(analyzeGame([2, 3, 4, 17, 32, 50], mega).maxSequence).toBe(3);
    expect(analyzeGame([1, 2, 3, 4, 5, 22], mega).maxSequence).toBe(5);
  });

  it("calcula o maior salto", () => {
    expect(analyzeGame([2, 5, 11, 30, 31, 60], mega).maxGap).toBe(29);
  });

  it("distribui por linha e coluna conforme a grade da modalidade", () => {
    const analysis = analyzeGame([1, 2, 11, 12, 60, 59], mega);
    expect(Object.keys(analysis.rowDistribution)).toHaveLength(mega.grid.rows);
    expect(Object.keys(analysis.columnDistribution)).toHaveLength(mega.grid.columns);
    const sum = Object.values(analysis.rowDistribution).reduce((a, b) => a + b, 0);
    expect(sum).toBe(6);

    const facil = resolveRules("lotofacil")!;
    expect(facil.grid.columns).toBe(5);
    expect(facil.grid.rows).toBe(5);
  });

  it("conta repetidas do concurso anterior", () => {
    const analysis = analyzeGame([1, 7, 18, 23, 43, 56], mega, {
      lastDrawNumbers: [7, 23, 44, 45, 46, 47],
      lastContestNumber: 3053,
    });
    expect(analysis.repeatedFromLast).toBe(2);
    expect(analysis.comparedToContest).toBe(3053);
    expect(analyzeGame([1, 7, 18, 23, 43, 56], mega).repeatedFromLast).toBeNull();
  });
});

describe("Mega-Sena", () => {
  const bounds = { min: 1, max: 60 };

  it("gera 6 dezenas sem fixos", () => expectValidBatch(request({ lotterySlug: "mega-sena", gamesCount: 10 }), bounds));

  it("gera 20 dezenas", () =>
    expectValidBatch(
      request({ lotterySlug: "mega-sena", numbersCount: 20, gamesCount: 5 }),
      bounds,
    ));

  it("respeita 1 e 5 fixos", () => {
    expectValidBatch(request({ lotterySlug: "mega-sena", gamesCount: 10, fixed: [5] }), bounds);
    expectValidBatch(
      request({ lotterySlug: "mega-sena", gamesCount: 10, fixed: [5, 17, 22, 39, 41] }),
      bounds,
    );
  });

  it("aceita fixos no limite do tamanho do jogo", () => {
    const games = expectValidBatch(
      request({ lotterySlug: "mega-sena", gamesCount: 1, fixed: [5, 17, 22, 39, 41, 60] }),
      bounds,
    );
    expect(games[0]!.key).toBe("05-17-22-39-41-60");
  });

  it("respeita exclusões, inclusive próximas do limite", () => {
    expectValidBatch(
      request({ lotterySlug: "mega-sena", gamesCount: 10, excluded: [1, 2, 3, 4, 5] }),
      bounds,
    );
    const excluded = Array.from({ length: 53 }, (_, i) => i + 8); // sobram 1..7
    expectValidBatch(request({ lotterySlug: "mega-sena", gamesCount: 7, excluded }), bounds);
  });
});

describe("Lotofácil", () => {
  const bounds = { min: 1, max: 25 };
  for (const numbersCount of [15, 16, 17, 18, 19, 20]) {
    it(`gera ${numbersCount} dezenas`, () =>
      expectValidBatch(
        request({ lotterySlug: "lotofacil", numbersCount, gamesCount: 5, fixed: [1, 2], excluded: [25] }),
        bounds,
      ));
  }
});

describe("Quina", () => {
  const bounds = { min: 1, max: 80 };
  for (let numbersCount = 5; numbersCount <= 15; numbersCount += 1) {
    it(`gera ${numbersCount} dezenas`, () =>
      expectValidBatch(
        request({ lotterySlug: "quina", numbersCount, gamesCount: 5, fixed: [7], excluded: [80] }),
        bounds,
      ));
  }
});

describe("configurações impossíveis", () => {
  const cases: Array<[string, GenerationRequest, string]> = [
    [
      "fixos acima do tamanho",
      request({ lotterySlug: "mega-sena", fixed: [1, 2, 3, 4, 5, 6, 7] }),
      "TOO_MANY_FIXED",
    ],
    [
      "exclusões excessivas",
      request({
        lotterySlug: "lotofacil",
        numbersCount: 15,
        excluded: Array.from({ length: 14 }, (_, i) => i + 12),
      }),
      "NOT_ENOUGH_AVAILABLE",
    ],
    [
      "mesmo número fixo e excluído",
      request({ lotterySlug: "quina", numbersCount: 5, fixed: [7], excluded: [7] }),
      "FIXED_EXCLUDED_OVERLAP",
    ],
    [
      "mais jogos do que possibilidades",
      request({
        lotterySlug: "mega-sena",
        gamesCount: 20,
        fixed: [1, 2, 3, 4, 5],
        excluded: Array.from({ length: 47 }, (_, i) => i + 14), // sobram 6..13
      }),
      "NOT_ENOUGH_COMBINATIONS",
    ],
    [
      "número fora do universo",
      request({ lotterySlug: "lotofacil", numbersCount: 15, fixed: [30] }),
      "OUT_OF_UNIVERSE",
    ],
    [
      "quantidade de dezenas inválida",
      request({ lotterySlug: "mega-sena", numbersCount: 21 }),
      "INVALID_NUMBERS_COUNT",
    ],
    ["zero jogos", request({ lotterySlug: "mega-sena", gamesCount: 0 }), "INVALID_GAMES_COUNT"],
    ["jogos negativos", request({ lotterySlug: "mega-sena", gamesCount: -3 }), "INVALID_GAMES_COUNT"],
    [
      "acima do limite de segurança",
      request({ lotterySlug: "mega-sena", gamesCount: generationConfig.maxGamesPerRequest + 1 }),
      "GAMES_LIMIT",
    ],
    ["modalidade inexistente", request({ lotterySlug: "loteria-x" }), "INVALID_LOTTERY"],
    [
      "dezena repetida nos fixos",
      request({ lotterySlug: "mega-sena", fixed: [5, 5] }),
      "DUPLICATED_NUMBER",
    ],
  ];

  for (const [name, req, code] of cases) {
    it(`bloqueia: ${name}`, () => {
      const { validation, games } = generateGames(req, { random: random() });
      expect(validation.ok).toBe(false);
      expect(validation.issues.map((issue) => issue.code)).toContain(code);
      expect(games).toHaveLength(0);
    });
  }
});

describe("duplicidade", () => {
  it("não repete chave em lotes grandes repetidos", () => {
    for (let round = 0; round < 5; round += 1) {
      const { games } = generateGames(
        request({ lotterySlug: "quina", numbersCount: 5, gamesCount: 100 }),
        { random: seededRandomSource(1000 + round) },
      );
      expect(new Set(games.map((game) => game.key)).size).toBe(100);
    }
  });

  it("esgota espaços pequenos com todas as combinações únicas", () => {
    // Mega-Sena com 5 fixos e apenas 8 dezenas livres => C(8,1) = 8 jogos.
    const excluded = Array.from({ length: 47 }, (_, i) => i + 14);
    const req = request({
      lotterySlug: "mega-sena",
      gamesCount: 8,
      fixed: [1, 2, 3, 4, 5],
      excluded,
    });
    const { validation, games } = generateGames(req, { random: random() });
    expect(validation.possibilities).toBe(8);
    expect(games).toHaveLength(8);
    expect(new Set(games.map((game) => game.key)).size).toBe(8);
  });
});

describe("possibilidades", () => {
  it("calcula C(A, N-F)", () => {
    const result = validateGenerationRequest(
      request({ lotterySlug: "mega-sena", gamesCount: 1, fixed: [1, 2], excluded: [3, 4, 5] }),
    );
    expect(result.possibilities).toBe(combinations(55, 4));
  });
});
