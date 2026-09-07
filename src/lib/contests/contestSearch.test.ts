import { describe, expect, it } from "vitest";

import {
  contestPageSizeOf,
  contestSituationOf,
  contestSortOf,
  formatNumbersLabel,
  parseNumbersParam,
  serializeNumbers,
} from "./contestSearch";
import { parseSearchDraws } from "@/lib/services/contestSearchService";
import { getLotteryConfig } from "@/config/lotteries";
import { validateCombination, windowOf } from "@/lib/statistics/statisticsView";

describe("filtros de concursos", () => {
  it("aceita dezenas separadas por vírgula, espaço ou traço e remove duplicadas", () => {
    expect(parseNumbersParam("5, 17 23-5")).toEqual([5, 17, 23]);
    expect(parseNumbersParam("")).toEqual([]);
    expect(parseNumbersParam(undefined)).toEqual([]);
  });

  it("serializa e formata as dezenas em ordem crescente", () => {
    expect(serializeNumbers([23, 5])).toBe("5,23");
    expect(serializeNumbers([])).toBeUndefined();
    expect(formatNumbersLabel([5, 23])).toBe("05 · 23");
  });

  it("usa valores padrão seguros para ordenação, situação e página", () => {
    expect(contestSortOf("qualquer")).toBe("recent");
    expect(contestSortOf("prize_desc")).toBe("prize_desc");
    expect(contestSituationOf("nada")).toBeNull();
    expect(contestSituationOf("accumulated")).toBe("accumulated");
    expect(contestPageSizeOf("999")).toBe(25);
    expect(contestPageSizeOf("100")).toBe(100);
  });

  it("lê a resposta do banco mesmo com campos ausentes", () => {
    const result = parseSearchDraws({
      total: 3,
      page: 2,
      pageSize: 10,
      rows: [{ id: "abc", contestNumber: 3053, numbers: [1, 13] }],
    });
    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.rows[0]).toMatchObject({ id: "abc", contestNumber: 3053, mainPrize: null });
    expect(parseSearchDraws(null).rows).toEqual([]);
  });
});

describe("consulta de estatísticas", () => {
  it("reconhece as janelas disponíveis", () => {
    expect(windowOf("50").value).toBe(50);
    expect(windowOf("all").value).toBeNull();
    expect(windowOf(undefined).value).toBeNull();
  });

  it("recusa combinações maiores do que o concurso sorteia", () => {
    const mega = getLotteryConfig("mega-sena")!;
    const invalid = validateCombination(mega, [1, 2, 3, 4, 5, 6, 7]);
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toContain("6 dezenas");
    expect(validateCombination(mega, [1, 2, 3]).ok).toBe(true);
    expect(validateCombination(mega, [61]).ok).toBe(false);
    expect(validateCombination(mega, [1, 1]).ok).toBe(false);
  });
});
