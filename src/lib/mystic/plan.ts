/** Planejamento do Meu Destino: quantos jogos o orçamento paga e como unir leituras guardadas. */
import type { MysticGame } from "./generator";

export const maxMysticGames = 30;

export interface MysticPlan {
  games: number;
  total: number;
  /** Sobra do orçamento. */
  change: number;
}

/** Quantos jogos de preço unitário cabem no orçamento (sempre ao menos zero, no máximo `maxMysticGames`). */
export function planGames(budget: number, unitPrice: number | null): MysticPlan {
  if (!Number.isFinite(budget) || budget <= 0 || !unitPrice || unitPrice <= 0) {
    return { games: 0, total: 0, change: Math.max(0, Number.isFinite(budget) ? budget : 0) };
  }
  // Centavos inteiros: evita erro de ponto flutuante (ex.: 0,1 + 0,2).
  const cents = Math.round(budget * 100);
  const unit = Math.round(unitPrice * 100);
  const games = Math.min(Math.floor(cents / unit), maxMysticGames);
  const total = (games * unit) / 100;
  return { games, total, change: (cents - games * unit) / 100 };
}

function sameGame(a: MysticGame, b: MysticGame): boolean {
  return a.numbers.length === b.numbers.length;
}

/**
 * Se já existe leitura guardada, ela vale: os primeiros jogos vêm dela e só o
 * que passar disso (orçamento maior) vem da geração atual. Assim o destino
 * nunca muda, mesmo que as regras do sistema evoluam.
 */
export function mergeWithStored(
  generated: MysticGame[],
  stored: MysticGame[] | null,
): MysticGame[] {
  if (!stored || stored.length === 0) return generated;
  return generated.map((game, index) => {
    const previous = stored[index];
    return previous && sameGame(previous, game) ? previous : game;
  });
}
