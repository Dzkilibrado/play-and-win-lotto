import { describe, expect, it } from "vitest";

import { clubKey, monthKeyFromName, parseClubLines } from "./secondaryKeys";

describe("chaves canônicas da seleção secundária", () => {
  it("mês: aceita acento, caixa e espaços", () => {
    expect(monthKeyFromName("MARÇO")).toBe("03");
    expect(monthKeyFromName(" marco ")).toBe("03");
    expect(monthKeyFromName("Dezembro")).toBe("12");
    expect(monthKeyFromName("Marteiro")).toBeNull();
  });

  it("clube: normaliza acento, caixa, espaços e barra da UF", () => {
    expect(clubKey("Flamengo / RJ")).toBe("FLAMENGO/RJ");
    expect(clubKey("  São  Paulo/SP ")).toBe("SAO PAULO/SP");
    expect(clubKey("CEARÁ/CE")).toBe("CEARA/CE");
  });
});

describe("lista de clubes colada pela administração", () => {
  it("aceita as grafias comuns e normaliza para Nome/UF", () => {
    const { clubs, invalid } = parseClubLines(
      ["1. Flamengo/RJ", "Corinthians - SP", "São Paulo (SP)", "", "flamengo/rj", "ABC / RN"].join(
        "\n",
      ),
    );
    expect(invalid).toEqual([]);
    expect(clubs).toEqual([
      { value: "FLAMENGO/RJ", label: "Flamengo/RJ" },
      { value: "CORINTHIANS/SP", label: "Corinthians/SP" },
      { value: "SAO PAULO/SP", label: "São Paulo/SP" },
      { value: "ABC/RN", label: "ABC/RN" },
    ]);
  });

  it("devolve as linhas sem UF para correção, sem descartá-las em silêncio", () => {
    const { clubs, invalid } = parseClubLines("Flamengo/RJ\nVasco");
    expect(clubs).toHaveLength(1);
    expect(invalid).toEqual(["Vasco"]);
  });
});
