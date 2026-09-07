/**
 * Teste de integração da resolução do "concurso anterior".
 * O banco é substituído por um duplo em memória — nenhum dado aqui é oficial.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeDraw {
  slug: string;
  contest_number: number;
  numbers: number[];
}

const draws: FakeDraw[] = [
  { slug: "mega-sena", contest_number: 3050, numbers: [1, 2, 3, 4, 5, 6] },
  { slug: "mega-sena", contest_number: 3051, numbers: [7, 8, 9, 10, 11, 12] },
  { slug: "mega-sena", contest_number: 3052, numbers: [13, 14, 15, 16, 17, 18] },
  { slug: "quina", contest_number: 6400, numbers: [21, 22, 23, 24, 25] },
  { slug: "quina", contest_number: 6401, numbers: [31, 32, 33, 34, 35] },
  { slug: "lotofacil", contest_number: 1, numbers: [1, 2, 3, 4, 5] },
];

function makeQuery() {
  const state: { slug: string | null; before: number | null } = { slug: null, before: null };
  const builder = {
    select: () => builder,
    eq: (_column: string, value: string) => {
      state.slug = value;
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    lt: (_column: string, value: number) => {
      state.before = value;
      return builder;
    },
    maybeSingle: async () => {
      const rows = draws
        .filter((draw) => draw.slug === state.slug)
        .filter((draw) => (state.before == null ? true : draw.contest_number < state.before))
        .sort((a, b) => b.contest_number - a.contest_number);
      const row = rows[0];
      if (!row) return { data: null, error: null };
      return {
        data: {
          contest_number: row.contest_number,
          draw_numbers: row.numbers.map((number) => ({ number })),
          lotteries: { slug: row.slug },
        },
        error: null,
      };
    },
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => makeQuery() },
}));

const { lotteryDataService } = await import("./lotteryDataService");

describe("concurso anterior", () => {
  beforeEach(() => vi.clearAllMocks());

  it("usa o concurso imediatamente anterior ao escolhido", async () => {
    const result = await lotteryDataService.getPreviousDraw("mega-sena", 3052);
    expect(result?.contestNumber).toBe(3051);
    expect(result?.numbers).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("nunca usa concurso de outra modalidade", async () => {
    const result = await lotteryDataService.getPreviousDraw("quina", 6401);
    expect(result?.contestNumber).toBe(6400);
    expect(result?.numbers).toEqual([21, 22, 23, 24, 25]);
  });

  it("concurso futuro usa o último já sorteado da modalidade", async () => {
    const result = await lotteryDataService.getPreviousDraw("mega-sena", 3999);
    expect(result?.contestNumber).toBe(3052);
  });

  it("sem concurso anterior retorna vazio", async () => {
    const result = await lotteryDataService.getPreviousDraw("lotofacil", 1);
    expect(result).toBeNull();
  });

  it('modo "último concurso sorteado" ignora o concurso escolhido', async () => {
    const result = await lotteryDataService.getPreviousDraw("mega-sena", null);
    expect(result?.contestNumber).toBe(3052);
  });
});
