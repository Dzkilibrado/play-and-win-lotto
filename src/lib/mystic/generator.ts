/**
 * Geração determinística dos jogos do "Meu Destino".
 *
 * Garantias (testadas):
 *  - mesmos dados + mesma loteria = mesmos números, sempre;
 *  - o jogo de índice k nunca muda quando se pede mais jogos (aumentar o
 *    orçamento só acrescenta jogos);
 *  - um jogo com mais dezenas contém o de menos dezenas do mesmo índice;
 *  - respeita as regras da loteria (faixa, quantidade, sem repetição).
 *
 * Importante: nenhuma tradição define "números de loteria". O peso dado aos
 * números ligados à leitura é uma convenção do sistema, para entretenimento.
 * Não altera a chance de acerto.
 */
import type { LotteryConfig } from "@/config/lotteries";

import { createRng } from "./hash";
import { digitalRoot } from "./numerology";
import { buildProfile, destinySeed, type MysticInput, type MysticProfile } from "./profile";

export interface MysticGame {
  numbers: number[];
  /** Seleção secundária (mês, time ou trevos) em chaves canônicas, quando a loteria tem. */
  secondary: string[];
}

export interface GenerateOptions {
  /** Quantidade de dezenas de cada jogo (um item por jogo). */
  sizes: number[];
  /** Chaves dos clubes, para a Timemania. */
  clubOptions?: readonly string[];
  currentYear: number;
}

const MAX_WEIGHT = 8;

function numberWeight(n: number, profile: MysticProfile): number {
  let weight = 1;
  for (const mark of profile.marks) {
    if (n === mark.value) weight += 1.6 * mark.weight;
    else if (mark.value > 1 && n % mark.value === 0) weight += 0.35 * mark.weight;
    if (n > 0 && digitalRoot(n) === digitalRoot(mark.value)) weight += 0.2 * mark.weight;
  }
  return Math.min(weight, MAX_WEIGHT);
}

/** Ordem de preferência de uma lista de pesos: sorteio ponderado sem reposição. */
function rankByWeight(items: { id: number; weight: number }[], rng: () => number): number[] {
  return items
    .map(({ id, weight }) => ({ id, key: Math.log(Math.max(rng(), 1e-12)) / weight }))
    .sort((a, b) => b.key - a.key || a.id - b.id)
    .map((entry) => entry.id);
}

function pickSecondary(
  lottery: LotteryConfig,
  profile: MysticProfile,
  rng: () => number,
  clubOptions: readonly string[],
): string[] {
  const secondary = lottery.secondary;
  if (!secondary) return [];
  const count = secondary.selectable.base;

  if (secondary.kind === "mes") {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
      let weight = 1;
      if (month === profile.birthMonth) weight += 3;
      for (const mark of profile.marks) if (mark.month === month) weight += mark.weight;
      return { id: month, weight };
    });
    return rankByWeight(ids, rng)
      .slice(0, count)
      .map((month) => String(month).padStart(2, "0"));
  }

  if (secondary.kind === "trevo") {
    const { min, max } = secondary.universe;
    const ids = Array.from({ length: max - min + 1 }, (_, i) => min + i).map((id) => ({
      id,
      weight: numberWeight(id, profile),
    }));
    return rankByWeight(ids, rng)
      .slice(0, count)
      .sort((a, b) => a - b)
      .map(String);
  }

  // Time do Coração: escolha estável entre os clubes cadastrados.
  if (clubOptions.length === 0) return [];
  const ids = clubOptions.map((_, index) => ({ id: index, weight: 1 }));
  return rankByWeight(ids, rng)
    .slice(0, count)
    .map((index) => clubOptions[index]!);
}

export function generateMysticGames(
  lottery: LotteryConfig,
  input: MysticInput,
  options: GenerateOptions,
): MysticGame[] {
  const profile = buildProfile(input, options.currentYear);
  const seed = destinySeed(input, lottery.slug);
  const { min, max } = lottery.universe;
  const universe = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const weights = universe.map((id) => ({ id, weight: numberWeight(id, profile) }));
  const clubs = options.clubOptions ?? [];
  const seen = new Set<string>();

  return options.sizes.map((size, index) => {
    const limit = Math.min(Math.max(size, lottery.selectable.min), lottery.selectable.max);
    // Jogo repetido (mesmas dezenas e mesmo tamanho) recebe uma nova rodada, de forma determinística.
    for (let round = 0; ; round += 1) {
      const rng = createRng(`${seed}|jogo|${index}|rodada|${round}`);
      const ranking = rankByWeight(weights, rng);
      const numbers = ranking.slice(0, limit).sort((a, b) => a - b);
      const signature = numbers.join(",");
      if (!seen.has(signature) || round >= 20) {
        seen.add(signature);
        const secondary = pickSecondary(
          lottery,
          profile,
          createRng(`${seed}|secundario|${index}|rodada|${round}`),
          clubs,
        );
        return { numbers, secondary };
      }
    }
  });
}
