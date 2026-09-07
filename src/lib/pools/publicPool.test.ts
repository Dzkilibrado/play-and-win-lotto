import { describe, expect, it } from "vitest";

import {
  filterParticipants,
  isPubliclyVisibleGame,
  publicGameName,
  publicGameStatuses,
  quotaText,
  quotaTextUpper,
  type PublicParticipant,
} from "@/lib/pools/publicPool";
import { formatCount } from "@/components/common/CountBadge";
import { gameStatusOrder } from "@/lib/games/gameStatus";

describe("jogos públicos", () => {
  it("exclui jogos apenas planejados", () => {
    expect(isPubliclyVisibleGame("PLANNED")).toBe(false);
  });

  it("inclui toda situação que representa aposta efetiva", () => {
    const expected = gameStatusOrder.filter((status) => status !== "PLANNED");
    expect(publicGameStatuses).toEqual(expected);
    for (const status of expected) expect(isPubliclyVisibleGame(status)).toBe(true);
  });

  it("nomeia o jogo com dois dígitos", () => {
    expect(publicGameName(1)).toBe("Jogo 01");
    expect(publicGameName(32)).toBe("Jogo 32");
  });
});

describe("participantes públicos", () => {
  const people: PublicParticipant[] = [
    { name: "Carlos", quotas: 2 },
    { name: "Maria", quotas: 2 },
    { name: "Antônio", quotas: 1 },
  ];

  it("busca sem diferenciar acento ou caixa", () => {
    expect(filterParticipants(people, "antonio")).toEqual([{ name: "Antônio", quotas: 1 }]);
    expect(filterParticipants(people, "MAR")).toEqual([{ name: "Maria", quotas: 2 }]);
  });

  it("sem busca devolve todos", () => {
    expect(filterParticipants(people, "  ")).toHaveLength(3);
  });

  it("usa singular e plural de cota", () => {
    expect(quotaText(1)).toBe("1 cota");
    expect(quotaText(3)).toBe("3 cotas");
    expect(quotaTextUpper(1)).toBe("1 COTA");
    expect(quotaTextUpper(3)).toBe("3 COTAS");
  });
});

describe("integridade do nome público", () => {
  const nomes = [
    "Gilber",
    "Gilberto",
    "Ana",
    "Ana Paula",
    "João",
    "João da Silva",
    "José",
    "José Carlos",
    "Maria Aparecida de Oliveira Rodrigues Nascimento",
  ];

  it("preserva o valor exato de cada nome cadastrado", () => {
    const people: PublicParticipant[] = nomes.map((name) => ({ name, quotas: 1 }));
    expect(filterParticipants(people, "").map((p) => p.name)).toEqual(nomes);
  });

  it("mantém nomes parecidos como pessoas distintas", () => {
    const people: PublicParticipant[] = [
      { name: "Gilber", quotas: 1 },
      { name: "Gilberto", quotas: 1 },
    ];
    const found = filterParticipants(people, "gilber");
    expect(found).toHaveLength(2);
    expect(found.map((p) => p.name)).toEqual(["Gilber", "Gilberto"]);
  });

  it("a busca não altera o nome devolvido", () => {
    const people: PublicParticipant[] = [{ name: "João da Silva", quotas: 2 }];
    expect(filterParticipants(people, "joao")[0]?.name).toBe("João da Silva");
  });
});

describe("contador de seção", () => {
  it("formata quantidades comuns e grandes", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1)).toBe("1");
    expect(formatCount(10)).toBe("10");
    expect(formatCount(100)).toBe("100");
    expect(formatCount(201)).toBe("201");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1000)).toBe("999+");
  });
});
