/**
 * Benchmark reproduzível (Fase 3C.1).
 *
 * Mede o cenário que a auditoria reproduziu (Lotofácil 15 dezenas, 100 jogos,
 * pesos + filtros) e confirma que as outras modalidades não regrediram.
 * Os números são impressos para registro; as asserções ficam propositalmente
 * folgadas para não tornar a suíte instável em máquinas diferentes.
 */
import { describe, expect, it } from "vitest";

import { defaultFilterStates } from "./filters";
import type { FilterStates } from "./filters/types";
import { generateGames } from "./generator";
import { seededRandomSource } from "./random";
import type { GenerationWeights } from "./types";

function weightsFor(universe: number): GenerationWeights {
  const numbers = Array.from({ length: universe }, (_, index) => index + 1);
  return {
    strategyId: "hybrid",
    intensity: "medium",
    window: 50,
    contestsAnalyzed: 1000,
    lastContestConsidered: 1000,
    numbers,
    // Perfil de pesos com razão ~6:1, como o teto aprovado da Fase 3C.
    values: numbers.map((value) => 0.5 + ((value * 7) % 13) * (2.5 / 13)),
  };
}


interface Run {
  generated: number;
  candidatesEvaluated: number;
  stopReason: string;
  durationMs: number;
  samplingMode: string | undefined;
}

function benchmark(
  label: string,
  build: () => { filters: FilterStates; slug: string; count: number; universe: number },
  rounds = 10,
  legacy = false,
) {
  const runs: Run[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const { filters, slug, count, universe } = build();
    const startedAt = Date.now();
    const outcome = generateGames(
      {
        lotterySlug: slug,
        numbersCount: count,
        gamesCount: 100,
        fixed: [],
        excluded: [],
        filters,
        previousDraw: null,
        weights: weightsFor(universe),
      },
      { random: seededRandomSource(1000 + round), legacyWeightedSampling: legacy },
    );

    runs.push({
      generated: outcome.metrics.generated,
      candidatesEvaluated: outcome.metrics.candidatesEvaluated,
      stopReason: outcome.metrics.stopReason,
      durationMs: Date.now() - startedAt,
      samplingMode: outcome.metrics.samplingMode,
    });
  }
  const times = runs.map((run) => run.durationMs).sort((a, b) => a - b);
  const summary = {
    label,
    min: times[0],
    median: times[Math.floor(times.length / 2)],
    mean: Math.round(times.reduce((sum, value) => sum + value, 0) / times.length),
    max: times[times.length - 1],
    timeLimits: runs.filter((run) => run.stopReason === "time_limit").length,
    generatedMin: Math.min(...runs.map((run) => run.generated)),
    mode: runs[0]!.samplingMode,
    evaluatedMedian: runs.map((r) => r.candidatesEvaluated).sort((a, b) => a - b)[
      Math.floor(runs.length / 2)
    ],
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary));
  return { runs, summary };
}

describe("desempenho com pesos", () => {
  /** Cenário reproduzido pela auditoria: Lotofácil apertada. */
  const hardLotofacil = () => {
    const filters = defaultFilterStates();
    filters.parity = { enabled: true, config: { min: 8, max: 8 } };
    filters.sum = { enabled: true, config: { min: 185, max: 205 } };
    filters.prime = { enabled: true, config: { min: 5, max: 6 } };
    filters.consecutive = { enabled: true, config: { max: 3 } };
    filters.gapRun = { enabled: true, config: { max: 2 } };
    return { filters, slug: "lotofacil", count: 15, universe: 25 };
  };

  it("Lotofácil apertada — antes (caminho da Fase 3C)", () => {
    benchmark("lotofacil-apertada-ANTES", hardLotofacil, 10, true);
  }, 180_000);

  it("Lotofácil apertada — depois (Fase 3C.1)", () => {
    const { summary } = benchmark("lotofacil-apertada-DEPOIS", hardLotofacil);
    expect(summary.timeLimits).toBeLessThanOrEqual(1);
  }, 180_000);

  it("Lotofácil 15 dezenas, 100 jogos, pesos e filtros restritivos", () => {
    const { summary } = benchmark("lotofacil-restritivo", () => {
      const filters = defaultFilterStates();

      filters.parity = { enabled: true, config: { min: 7, max: 8 } };
      filters.sum = { enabled: true, config: { min: 180, max: 210 } };
      filters.prime = { enabled: true, config: { min: 4, max: 6 } };
      filters.consecutive = { enabled: true, config: { max: 4 } };
      return { filters, slug: "lotofacil", count: 15, universe: 25 };
    });
    expect(summary.timeLimits).toBe(0);
    expect(summary.generatedMin).toBe(100);
  }, 120_000);

  it("Mega-Sena 6 dezenas, 100 jogos, pesos e filtros", () => {
    const { summary } = benchmark("mega-sena", () => {
      const filters = defaultFilterStates();
      filters.parity = { enabled: true, config: { min: 2, max: 4 } };
      filters.sum = { enabled: true, config: { min: 150, max: 220 } };
      filters.prime = { enabled: true, config: { min: 1, max: 3 } };
      return { filters, slug: "mega-sena", count: 6, universe: 60 };
    });
    expect(summary.timeLimits).toBe(0);
    expect(summary.generatedMin).toBe(100);
  }, 120_000);

  it("Quina 5 dezenas, 100 jogos, pesos e filtros", () => {
    const { summary } = benchmark("quina", () => {
      const filters = defaultFilterStates();
      filters.parity = { enabled: true, config: { min: 2, max: 3 } };
      filters.sum = { enabled: true, config: { min: 150, max: 260 } };
      filters.gapRun = { enabled: true, config: { max: 2 } };
      return { filters, slug: "quina", count: 5, universe: 80 };
    });
    expect(summary.timeLimits).toBe(0);
    expect(summary.generatedMin).toBe(100);
  }, 120_000);

  it("sem pesos continua no caminho eficiente da Fase 3B", () => {
    const filters = defaultFilterStates();
    filters.parity = { enabled: true, config: { min: 7, max: 8 } };
    const outcome = generateGames(
      {
        lotterySlug: "lotofacil",
        numbersCount: 15,
        gamesCount: 100,
        fixed: [],
        excluded: [],
        filters,
        previousDraw: null,
        weights: null,
      },
      { random: seededRandomSource(7) },
    );
    expect(outcome.metrics.samplingMode).toBe("uniform_sampling");
    expect(outcome.metrics.generated).toBe(100);
  }, 60_000);
});
