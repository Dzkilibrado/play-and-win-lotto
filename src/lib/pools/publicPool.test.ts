import { describe, expect, it } from "vitest";

import {
  filterParticipants,
  isPubliclyVisibleGame,
  publicGameName,
  publicGameStatuses,
  quotaText,
  type PublicParticipant,
} from "@/lib/pools/publicPool";
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
  });
});
