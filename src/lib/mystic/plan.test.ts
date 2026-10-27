import { describe, expect, it } from "vitest";

import type { MysticGame } from "./generator";
import { maxMysticGames, mergeWithStored, planGames } from "./plan";

describe("planGames", () => {
  it("calcula jogos e troco em centavos", () => {
    expect(planGames(30, 6)).toEqual({ games: 5, total: 30, change: 0 });
    expect(planGames(10, 6)).toEqual({ games: 1, total: 6, change: 4 });
    expect(planGames(0.3, 0.1).games).toBe(3);
  });
  it("orçamento insuficiente ou preço ausente = zero jogos", () => {
    expect(planGames(3, 6).games).toBe(0);
    expect(planGames(50, null).games).toBe(0);
    expect(planGames(-5, 6).games).toBe(0);
    expect(planGames(Number.NaN, 6).games).toBe(0);
  });
  it("limita a quantidade de jogos", () => {
    expect(planGames(100000, 6).games).toBe(maxMysticGames);
  });
});

describe("mergeWithStored", () => {
  const g = (numbers: number[]): MysticGame => ({ numbers, secondary: [] });
  it("sem leitura guardada usa a geração atual", () => {
    const now = [g([1, 2, 3, 4, 5, 6])];
    expect(mergeWithStored(now, null)).toBe(now);
  });
  it("a leitura guardada prevalece e o excedente vem da geração atual", () => {
    const stored = [g([10, 11, 12, 13, 14, 15])];
    const now = [g([1, 2, 3, 4, 5, 6]), g([7, 8, 9, 10, 11, 12])];
    const merged = mergeWithStored(now, stored);
    expect(merged[0]).toEqual(stored[0]);
    expect(merged[1]).toEqual(now[1]);
  });
  it("tamanho diferente não reaproveita o jogo guardado", () => {
    const stored = [g([1, 2, 3, 4, 5, 6, 7])];
    const now = [g([1, 2, 3, 4, 5, 6])];
    expect(mergeWithStored(now, stored)[0]).toEqual(now[0]);
  });
});
