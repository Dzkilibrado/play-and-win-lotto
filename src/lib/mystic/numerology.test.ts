import { describe, expect, it } from "vitest";

import {
  birthDayNumber,
  digitalRoot,
  expressionNumber,
  groupNumber,
  lifePathNumber,
  normalizeName,
  personalityNumber,
  personalYearNumber,
  reduceNumber,
  soulNumber,
} from "./numerology";

describe("numerologia pitagórica", () => {
  it("ignora acentos, espaços e símbolos", () => {
    expect(normalizeName("  João d'Ávila-Souza ")).toBe("JOAODAVILASOUZA");
  });
  it("reduz preservando mestres 11, 22 e 33", () => {
    expect(reduceNumber(38)).toBe(11);
    expect(reduceNumber(49)).toBe(4);
    expect(reduceNumber(22)).toBe(22);
    expect(reduceNumber(33)).toBe(33);
    expect(digitalRoot(29)).toBe(2);
  });
  it("calcula expressão, alma e personalidade (tabela conferida na fonte)", () => {
    // A=1 N=5 A=1 → 7 ; vogais A,A = 2 ; consoante N = 5
    expect(expressionNumber("Ana")).toBe(7);
    expect(soulNumber("Ana")).toBe(2);
    expect(personalityNumber("Ana")).toBe(5);
    // acento não muda o valor
    expect(expressionNumber("Ana")).toBe(expressionNumber("Aná"));
  });
  it("Y é consoante por convenção", () => {
    // Y=7 conta como consoante: personalidade de "Yan" = 7+5 = 12 → 3
    expect(personalityNumber("Yan")).toBe(3);
    expect(soulNumber("Yan")).toBe(1);
  });
  it("caminho de vida, dia e ano pessoal", () => {
    // 15/07/1990: dia 15→6, mês 7, ano 1990→1 ⇒ 14 → 5
    expect(lifePathNumber({ year: 1990, month: 7, day: 15 })).toBe(5);
    expect(birthDayNumber({ year: 1990, month: 7, day: 15 })).toBe(6);
    // ano 2026 → 10 → 1 ; 6 + 7 + 1 = 14 → 5
    expect(personalYearNumber({ year: 1990, month: 7, day: 15 }, 2026)).toBe(5);
  });
  it("vibração do grupo", () => {
    expect(groupNumber(10)).toBe(1);
    expect(groupNumber(11)).toBe(11);
    expect(groupNumber(1)).toBe(1);
  });
});
