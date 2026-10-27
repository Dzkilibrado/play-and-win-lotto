import { describe, expect, it } from "vitest";

import { maisMilionariaTiers } from "@/config/lotteries";
import { type OfficialTier } from "./checkEngine";
import { checkJointGame } from "./joint";

const tiers: OfficialTier[] = maisMilionariaTiers.map((def, index) => ({
  drawPrizeId: null,
  tier: def.label,
  hits: def.key,
  prizePerWinner: 1000 - index * 100,
}));
const prize = (label: string) => tiers.find((tier) => tier.tier === label)!.prizePerWinner!;

const drawNumbers = [1, 2, 3, 4, 5, 6];
const drawClovers = [2, 5];

function run(gameNumbers: number[], gameClovers: number[], official = tiers) {
  return checkJointGame({
    gameNumbers,
    gameClovers,
    drawNumbers,
    drawClovers,
    baseSize: 6,
    cloverBase: 2,
    defs: maisMilionariaTiers,
    tiers: official,
  });
}

describe("faixas conjuntas da +Milionária", () => {
  it("as chaves das 10 faixas são únicas", () => {
    expect(new Set(maisMilionariaTiers.map((tier) => tier.key)).size).toBe(10);
  });

  it("aposta simples: 6 dezenas + 2 trevos é a faixa 1", () => {
    const result = run([1, 2, 3, 4, 5, 6], [2, 5]);
    expect(result.simpleBets).toBe(1);
    expect(result.breakdown.map((entry) => entry.tier)).toEqual(["6 acertos + 2 trevos"]);
    expect(result.totalPrize).toBe(prize("6 acertos + 2 trevos"));
  });

  it("6 dezenas com 1 trevo, ou nenhum, cai na faixa '1 ou nenhum trevo'", () => {
    expect(run([1, 2, 3, 4, 5, 6], [2, 3]).breakdown[0]?.tier).toBe(
      "6 acertos + 1 ou nenhum trevo",
    );
    expect(run([1, 2, 3, 4, 5, 6], [3, 4]).breakdown[0]?.tier).toBe(
      "6 acertos + 1 ou nenhum trevo",
    );
  });

  it("3 dezenas + 0 trevo e 2 dezenas + 0 trevo não premiam", () => {
    expect(run([1, 2, 3, 40, 41, 42], [3, 4]).isPrized).toBe(false);
    expect(run([1, 2, 40, 41, 42, 43], [3, 4]).isPrized).toBe(false);
  });

  it("3 dezenas + 1 trevo e 2 dezenas + 1 trevo têm faixa própria", () => {
    expect(run([1, 2, 3, 40, 41, 42], [2, 3]).breakdown[0]?.tier).toBe("3 acertos + 1 trevo");
    expect(run([1, 2, 40, 41, 42, 43], [2, 3]).breakdown[0]?.tier).toBe("2 acertos + 1 trevo");
    expect(run([1, 2, 40, 41, 42, 43], [2, 5]).breakdown[0]?.tier).toBe("2 acertos + 2 trevos");
  });

  it("aposta múltipla: 7 dezenas (6 certas) e 3 trevos distribui por faixa sem dupla contagem", () => {
    // 7 dezenas = 7 apostas de 6; com 6 certas: 1 sena + 6 quinas. 3 trevos = 3 pares;
    // com os 2 trevos sorteados entre eles: 1 par "2 trevos" e 2 pares "1 trevo".
    const result = run([1, 2, 3, 4, 5, 6, 40], [2, 5, 3]);
    expect(result.simpleBets).toBe(7 * 3);
    const byTier = Object.fromEntries(
      result.breakdown.map((entry) => [entry.tier, entry.winningCombinations]),
    );
    expect(byTier).toEqual({
      "6 acertos + 2 trevos": 1,
      "6 acertos + 1 ou nenhum trevo": 2,
      "5 acertos + 2 trevos": 6,
      "5 acertos + 1 ou nenhum trevo": 12,
    });
    const total = Object.values(byTier).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(21); // todas as 21 apostas simples caem em exatamente uma faixa
  });

  it("soma as faixas com valor e marca pendente quando falta o valor oficial", () => {
    const pending = tiers.map((tier) =>
      tier.tier === "6 acertos + 2 trevos" ? { ...tier, prizePerWinner: null } : tier,
    );
    const result = run([1, 2, 3, 4, 5, 6, 40], [2, 5], pending);
    expect(result.amountPending).toBe(true);
    expect(result.totalPrize).toBe(6 * prize("5 acertos + 2 trevos"));
  });

  it("faixa que a fonte não trouxe nunca é inventada", () => {
    const result = run([1, 2, 3, 4, 5, 6], [2, 5], []);
    expect(result.isPrized).toBe(false);
  });

  it("recusa jogo com menos trevos ou concurso sem os 2 trevos sorteados", () => {
    expect(() => run([1, 2, 3, 4, 5, 6], [2])).toThrow();
    expect(() =>
      checkJointGame({
        gameNumbers: [1, 2, 3, 4, 5, 6],
        gameClovers: [2, 5],
        drawNumbers,
        drawClovers: [2],
        baseSize: 6,
        cloverBase: 2,
        defs: maisMilionariaTiers,
        tiers,
      }),
    ).toThrow();
  });
});
