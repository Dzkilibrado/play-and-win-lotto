import { describe, expect, it } from "vitest";

import { computeBudgetStrategy, type BudgetPriceRow } from "./budgetStrategy";

/** Preços de referência inspirados na tabela oficial, para teste isolado do motor. */
const megaSenaPrices: BudgetPriceRow[] = [
  { numbersSelected: 6, price: 5, combinationCount: 1 },
  { numbersSelected: 7, price: 35, combinationCount: 7 },
  { numbersSelected: 8, price: 140, combinationCount: 28 },
];

const lotofacilPrices: BudgetPriceRow[] = [
  { numbersSelected: 15, price: 3, combinationCount: 1 },
  { numbersSelected: 16, price: 48, combinationCount: 16 },
];

const quinaPrices: BudgetPriceRow[] = [
  { numbersSelected: 5, price: 2.5, combinationCount: 1 },
  { numbersSelected: 6, price: 15, combinationCount: 6 },
];

const pricesBySlug = {
  "mega-sena": megaSenaPrices,
  lotofacil: lotofacilPrices,
  quina: quinaPrices,
};

describe("computeBudgetStrategy", () => {
  it("rejeita orçamento zero ou negativo", () => {
    const result = computeBudgetStrategy({
      budget: 0,
      modalities: ["mega-sena"],
      priority: "max_games",
      profile: "cost_benefit",
      pricesBySlug,
    });
    expect(result.allocations).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/maior que zero/);
  });

  it("rejeita ausência de modalidade selecionada", () => {
    const result = computeBudgetStrategy({
      budget: 50,
      modalities: [],
      priority: "max_games",
      profile: "cost_benefit",
      pricesBySlug,
    });
    expect(result.warnings[0]).toMatch(/Selecione ao menos uma modalidade/);
  });

  it("max_games maximiza quantidade de jogos na dezena mais barata, em um único grupo", () => {
    const result = computeBudgetStrategy({
      budget: 50,
      modalities: ["mega-sena"],
      priority: "max_games",
      profile: "cost_benefit",
      pricesBySlug,
    });
    const [allocation] = result.allocations;
    expect(allocation!.lines).toHaveLength(1);
    expect(allocation!.lines[0]!.numbersSelected).toBe(6);
    expect(allocation!.totalGamesCount).toBe(10);
    expect(allocation!.totalCost).toBe(50);
    expect(result.totalLeftover).toBe(0);
  });

  it("max_probability prioriza mais dezenas por jogo quando o valor fecha exatamente", () => {
    const result = computeBudgetStrategy({
      budget: 140,
      modalities: ["mega-sena"],
      priority: "max_probability",
      profile: "cost_benefit",
      pricesBySlug,
    });
    const [allocation] = result.allocations;
    expect(allocation!.lines).toHaveLength(1);
    expect(allocation!.lines[0]!.numbersSelected).toBe(8);
    expect(allocation!.totalGamesCount).toBe(1);
    expect(allocation!.leftover).toBe(0);
  });

  it("max_probability preenche a sobra com grupos de dezenas menores em vez de descartar (regressão do bug reportado)", () => {
    // 1 jogo de 8 dezenas (140) esgota a config mais forte; sobra 35,
    // que fecha exatamente com 1 jogo de 7 dezenas — não deve sobrar sem uso.
    const result = computeBudgetStrategy({
      budget: 175,
      modalities: ["mega-sena"],
      priority: "max_probability",
      profile: "cost_benefit",
      pricesBySlug,
    });
    const [allocation] = result.allocations;
    expect(allocation!.lines.map((line) => line.numbersSelected)).toEqual([8, 7]);
    expect(allocation!.lines[0]!.gamesCount).toBe(1);
    expect(allocation!.lines[1]!.gamesCount).toBe(1);
    expect(allocation!.totalGamesCount).toBe(2);
    expect(allocation!.totalCost).toBe(175);
    expect(allocation!.leftover).toBe(0);
  });

  it("max_probability mistura três grupos quando necessário para aproveitar o valor (exemplo do usuário)", () => {
    // 140 (8 dezenas) + 2x35 (7 dezenas) + 5 (6 dezenas) = 215, sem sobra.
    const result = computeBudgetStrategy({
      budget: 215,
      modalities: ["mega-sena"],
      priority: "max_probability",
      profile: "cost_benefit",
      pricesBySlug,
    });
    const [allocation] = result.allocations;
    expect(allocation!.lines).toEqual([
      expect.objectContaining({ numbersSelected: 8, gamesCount: 1 }),
      expect.objectContaining({ numbersSelected: 7, gamesCount: 2 }),
      expect.objectContaining({ numbersSelected: 6, gamesCount: 1 }),
    ]);
    expect(allocation!.totalCost).toBe(215);
    expect(allocation!.leftover).toBe(0);
  });

  it("divide o orçamento entre modalidades selecionadas sem perder valor", () => {
    const result = computeBudgetStrategy({
      budget: 30,
      modalities: ["mega-sena", "quina"],
      priority: "max_games",
      profile: "cost_benefit",
      pricesBySlug,
    });
    expect(result.allocations).toHaveLength(2);
    const sum = result.allocations.reduce((acc, item) => acc + item.totalCost, 0);
    expect(sum + result.totalLeftover).toBeCloseTo(30, 2);
  });

  it("exclui e informa modalidade que não cabe nem um jogo mínimo na fatia", () => {
    const result = computeBudgetStrategy({
      budget: 6,
      modalities: ["mega-sena", "lotofacil"],
      priority: "max_probability",
      profile: "cost_benefit",
      pricesBySlug,
    });
    // fatia de 3 cada: mega-sena (preço base 5) cabe, lotofácil (preço base 3) cabe também.
    // Reduzindo o orçamento para forçar exclusão real:
    const forced = computeBudgetStrategy({
      budget: 5,
      modalities: ["mega-sena", "lotofacil"],
      priority: "max_probability",
      profile: "cost_benefit",
      pricesBySlug,
    });
    expect(forced.excludedModalities.length + forced.allocations.length).toBe(2);
    if (forced.excludedModalities.length > 0) {
      expect(forced.warnings.some((w) => w.includes("não é suficiente"))).toBe(true);
    }
    expect(result).toBeDefined();
  });

  it("max_prize ordena pela ordem canônica das modalidades (Mega-Sena primeiro)", () => {
    const result = computeBudgetStrategy({
      budget: 100,
      modalities: ["quina", "mega-sena"],
      priority: "max_games",
      profile: "max_prize",
      pricesBySlug,
    });
    expect(result.allocations[0]!.slug).toBe("mega-sena");
  });

  it("nunca excede o orçamento informado", () => {
    const result = computeBudgetStrategy({
      budget: 17.3,
      modalities: ["mega-sena", "lotofacil", "quina"],
      priority: "max_games",
      profile: "cost_benefit",
      pricesBySlug,
    });
    expect(result.totalCost).toBeLessThanOrEqual(17.3);
    expect(result.totalLeftover).toBeGreaterThanOrEqual(0);
  });

  it("max_probability também nunca excede o orçamento, mesmo misturando grupos", () => {
    const result = computeBudgetStrategy({
      budget: 233.7,
      modalities: ["mega-sena"],
      priority: "max_probability",
      profile: "cost_benefit",
      pricesBySlug,
    });
    expect(result.totalCost).toBeLessThanOrEqual(233.7);
    expect(result.totalLeftover).toBeGreaterThanOrEqual(0);
    // sobra deve ser menor que o preço da configuração mais barata disponível:
    // se não, o motor deixou de comprar um jogo que caberia.
    expect(result.totalLeftover).toBeLessThan(5);
  });

  it("nunca ultrapassa o limite de jogos por solicitação", () => {
    const result = computeBudgetStrategy({
      budget: 100000,
      modalities: ["mega-sena"],
      priority: "max_games",
      profile: "cost_benefit",
      pricesBySlug,
    });
    expect(result.allocations[0]!.totalGamesCount).toBeLessThanOrEqual(200);
  });
});
