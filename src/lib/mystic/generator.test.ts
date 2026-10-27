import { describe, expect, it } from "vitest";

import { activeLotteries, getLotteryConfig } from "@/config/lotteries";

import { generateMysticGames } from "./generator";
import { revealPhrase } from "./messages";
import { destinySeed, readingFingerprint, type MysticInput } from "./profile";

const base: MysticInput = {
  fullName: "Maria da Silva Souza",
  birthDate: "1990-07-15",
  birthTime: "08:30",
  birthPlace: { latitude: -23.55, longitude: -46.63, timeZone: "America/Sao_Paulo" },
  intention: "SORTE",
  tradition: "COMBINADA",
  groupSize: null,
};
const clubs = ["FLAMENGO/RJ", "PALMEIRAS/SP", "SANTOS/SP", "CORINTHIANS/SP"];

describe("Meu Destino — gerador", () => {
  it("é determinístico: mesmos dados, mesmos números", () => {
    const mega = getLotteryConfig("mega-sena");
    const a = generateMysticGames(mega, base, { sizes: [6, 6, 7], currentYear: 2026 });
    const b = generateMysticGames(mega, base, { sizes: [6, 6, 7], currentYear: 2026 });
    expect(b).toEqual(a);
  });

  it("dados diferentes mudam os números", () => {
    const mega = getLotteryConfig("mega-sena");
    const a = generateMysticGames(mega, base, { sizes: [6], currentYear: 2026 });
    const b = generateMysticGames(
      mega,
      { ...base, birthDate: "1991-07-15" },
      { sizes: [6], currentYear: 2026 },
    );
    expect(b[0]?.numbers).not.toEqual(a[0]?.numbers);
  });

  it("aumentar o orçamento só acrescenta jogos (os primeiros não mudam)", () => {
    const mega = getLotteryConfig("mega-sena");
    const few = generateMysticGames(mega, base, { sizes: [6, 6], currentYear: 2026 });
    const many = generateMysticGames(mega, base, { sizes: [6, 6, 6, 6], currentYear: 2026 });
    expect(many.slice(0, 2)).toEqual(few);
  });

  it("jogo maior contém o menor do mesmo índice", () => {
    const mega = getLotteryConfig("mega-sena");
    const small = generateMysticGames(mega, base, { sizes: [6], currentYear: 2026 })[0]!;
    const large = generateMysticGames(mega, base, { sizes: [9], currentYear: 2026 })[0]!;
    expect(small.numbers.every((n) => large.numbers.includes(n))).toBe(true);
  });

  it("respeita as regras de toda loteria ativa", () => {
    for (const lottery of activeLotteries) {
      const size = lottery.selectable.min;
      const games = generateMysticGames(lottery, base, {
        sizes: [size, size, size],
        clubOptions: clubs,
        currentYear: 2026,
      });
      expect(games).toHaveLength(3);
      for (const game of games) {
        expect(game.numbers).toHaveLength(size);
        expect(new Set(game.numbers).size).toBe(size);
        expect(
          game.numbers.every((n) => n >= lottery.universe.min && n <= lottery.universe.max),
        ).toBe(true);
        expect([...game.numbers].sort((x, y) => x - y)).toEqual(game.numbers);
        if (lottery.secondary) {
          expect(game.secondary).toHaveLength(lottery.secondary.selectable.base);
        } else {
          expect(game.secondary).toEqual([]);
        }
      }
      const signatures = new Set(games.map((game) => game.numbers.join(",")));
      // Lotofácil escolhe 15 de 25; ainda assim os 3 jogos devem ser distintos.
      expect(signatures.size).toBe(3);
    }
  });

  it("Mês da Sorte e trevos usam chaves canônicas", () => {
    const dia = generateMysticGames(getLotteryConfig("dia-de-sorte"), base, {
      sizes: [7],
      currentYear: 2026,
    })[0]!;
    expect(dia.secondary[0]).toMatch(/^(0[1-9]|1[0-2])$/);
    const mais = generateMysticGames(getLotteryConfig("mais-milionaria"), base, {
      sizes: [6],
      currentYear: 2026,
    })[0]!;
    expect(mais.secondary).toHaveLength(2);
    expect(mais.secondary.every((trevo) => /^[1-6]$/.test(trevo))).toBe(true);
    const time = generateMysticGames(getLotteryConfig("timemania"), base, {
      sizes: [10],
      clubOptions: clubs,
      currentYear: 2026,
    })[0]!;
    expect(clubs).toContain(time.secondary[0]);
  });

  it("quantidade de pessoas do bolão entra na leitura", () => {
    const mega = getLotteryConfig("mega-sena");
    const solo = generateMysticGames(mega, base, { sizes: [6], currentYear: 2026 });
    const grupo = generateMysticGames(
      mega,
      { ...base, groupSize: 8 },
      { sizes: [6], currentYear: 2026 },
    );
    expect(grupo[0]?.numbers).not.toEqual(solo[0]?.numbers);
  });

  it("sem hora e cidade a leitura segue e é estável", () => {
    const mega = getLotteryConfig("mega-sena");
    const semHora = { ...base, birthTime: null, birthPlace: null };
    const a = generateMysticGames(mega, semHora, { sizes: [6], currentYear: 2026 });
    expect(generateMysticGames(mega, semHora, { sizes: [6], currentYear: 2026 })).toEqual(a);
  });

  it("nome com acento, caixa e espaços extras dá o mesmo destino", () => {
    const mega = getLotteryConfig("mega-sena");
    const a = generateMysticGames(
      mega,
      { ...base, fullName: "José  da Silva" },
      { sizes: [6], currentYear: 2026 },
    );
    const b = generateMysticGames(
      mega,
      { ...base, fullName: "JOSE DA SILVA" },
      { sizes: [6], currentYear: 2026 },
    );
    expect(b).toEqual(a);
  });
});

describe("identificação da leitura", () => {
  it("é estável, depende do usuário e da loteria", () => {
    const f1 = readingFingerprint(base, "mega-sena", "user-1");
    expect(
      readingFingerprint({ ...base, fullName: "MARIA DA SILVA SOUZA" }, "mega-sena", "user-1"),
    ).toBe(f1);
    expect(readingFingerprint(base, "mega-sena", "user-2")).not.toBe(f1);
    expect(readingFingerprint(base, "quina", "user-1")).not.toBe(f1);
    expect(readingFingerprint({ ...base, intention: "AMOR" }, "mega-sena", "user-1")).not.toBe(f1);
  });
  it("a semente não depende do usuário", () => {
    expect(destinySeed(base, "mega-sena")).toBe(destinySeed({ ...base }, "mega-sena"));
  });
  it("a frase de revelação é estável", () => {
    const seed = destinySeed(base, "mega-sena");
    expect(revealPhrase("SORTE", seed)).toBe(revealPhrase("SORTE", seed));
  });
});
