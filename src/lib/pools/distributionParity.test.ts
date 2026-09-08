/**
 * Paridade entre o rateio oficial (função do banco `pool_calculate_distribution`)
 * e a prévia da tela (`poolMath.calculateDistribution`).
 *
 * `sqlDistribution` reproduz literalmente a aritmética da função SQL:
 *   cents      = round(total * 100)
 *   base       = cents / cotas_totais          (divisão inteira)
 *   remainder  = cents - base * cotas_totais
 *   extra_i    = floor(remainder / participantes)
 *                + (i < remainder % participantes ? 1 : 0)
 *   parcela_i  = base * cotas_i + extra_i
 * na mesma ordem determinística: mais cotas primeiro, depois nome, depois id.
 *
 * O invariante que interessa à auditoria é único: a soma de todas as parcelas
 * é exatamente o prêmio distribuível, até o último centavo.
 */
import { describe, expect, it } from "vitest";

import { calculateDistribution, type QuotaParticipant } from "./poolMath";

interface SqlShare {
  participantId: string;
  cents: number;
}

function sqlDistribution(totalPrize: number, participants: QuotaParticipant[]): SqlShare[] {
  const eligible = participants
    .filter((p) => p.eligible && !p.cancelled && p.quotas > 0)
    .sort((a, b) => {
      if (b.quotas !== a.quotas) return b.quotas - a.quotas;
      const byName = a.name.localeCompare(b.name, "pt-BR");
      if (byName !== 0) return byName;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const totalQuotas = eligible.reduce((sum, p) => sum + p.quotas, 0);
  if (totalQuotas <= 0) return [];

  const cents = Math.round(totalPrize * 100);
  const base = Math.floor(cents / totalQuotas);
  const remainder = cents - base * totalQuotas;
  const count = eligible.length;

  return eligible.map((participant, index) => ({
    participantId: participant.id,
    cents:
      base * participant.quotas +
      Math.floor(remainder / count) +
      (index < remainder % count ? 1 : 0),
  }));
}

const person = (id: string, name: string, quotas: number): QuotaParticipant => ({
  id,
  name,
  quotas,
  eligible: true,
});

const scenarios: Array<{ label: string; prize: number; people: QuotaParticipant[] }> = [
  {
    label: "R$ 10,00 em 6 cotas — 3 participantes de 2 cotas",
    prize: 10,
    people: [person("a", "Ana", 2), person("b", "Bia", 2), person("c", "Caio", 2)],
  },
  {
    label: "R$ 100,00 em 3 cotas",
    prize: 100,
    people: [person("a", "Ana", 1), person("b", "Bia", 1), person("c", "Caio", 1)],
  },
  {
    label: "R$ 10,00 em 6 cotas com distribuição desigual",
    prize: 10,
    people: [person("a", "Ana", 3), person("b", "Bia", 2), person("c", "Caio", 1)],
  },
  {
    label: "R$ 0,01",
    prize: 0.01,
    people: [person("a", "Ana", 1), person("b", "Bia", 1), person("c", "Caio", 1)],
  },
  {
    label: "R$ 1.000,01",
    prize: 1000.01,
    people: [person("a", "Ana", 5), person("b", "Bia", 3), person("c", "Caio", 2), person("d", "Duda", 1)],
  },
  {
    label: "muitos participantes",
    prize: 451_695.33,
    people: Array.from({ length: 97 }, (_, i) => person(`p${i}`, `Nome ${i}`, 1)),
  },
  {
    label: "participante com múltiplas cotas",
    prize: 77.77,
    people: [person("a", "Ana", 10), person("b", "Bia", 7), person("c", "Caio", 3), person("d", "Duda", 1)],
  },
];

describe("rateio oficial: soma exata", () => {
  it.each(scenarios)("$label fecha no centavo pela regra do banco", ({ prize, people }) => {
    const shares = sqlDistribution(prize, people);
    const total = shares.reduce((sum, share) => sum + share.cents, 0);
    expect(total).toBe(Math.round(prize * 100));
    expect(shares).toHaveLength(people.length);
  });

  it.each(scenarios)("$label fecha no centavo na prévia da tela", ({ prize, people }) => {
    const preview = calculateDistribution(prize, people);
    const total = preview.shares.reduce((sum, share) => sum + Math.round(share.shareAmount * 100), 0);
    expect(total).toBe(Math.round(prize * 100));
  });

  it.each(scenarios)("$label: prévia e regra do banco coincidem parcela a parcela", ({ prize, people }) => {
    const official = sqlDistribution(prize, people);
    const preview = calculateDistribution(prize, people).shares.map((share) => ({
      participantId: share.participantId,
      cents: Math.round(share.shareAmount * 100),
    }));
    expect(preview).toEqual(official);
  });
});

describe("rateio oficial: propriedades gerais", () => {
  it("fecha exato para qualquer prêmio e composição de cotas", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const count = (seed % 11) + 1;
      const people = Array.from({ length: count }, (_, i) =>
        person(`p${i}`, `Nome ${i}`, ((seed * (i + 3)) % 9) + 1),
      );
      const prize = Math.round(seed * 1234.567) / 100;
      const total = sqlDistribution(prize, people).reduce((sum, s) => sum + s.cents, 0);
      expect(total).toBe(Math.round(prize * 100));
    }
  });

  it("nenhuma parcela é negativa e a diferença entre cotas iguais é de no máximo um centavo", () => {
    const people = [person("a", "Ana", 2), person("b", "Bia", 2), person("c", "Caio", 2)];
    const shares = sqlDistribution(10, people).map((s) => s.cents);
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it("é determinístico: a mesma entrada devolve sempre o mesmo resultado", () => {
    const people = [person("c", "Caio", 1), person("a", "Ana", 1), person("b", "Bia", 3)];
    expect(sqlDistribution(10.01, people)).toEqual(sqlDistribution(10.01, [...people].reverse()));
  });
});
