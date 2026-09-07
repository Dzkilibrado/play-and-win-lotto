/**
 * Regras puras da tela de Estatísticas.
 *
 * Os números vêm agregados do banco (`lottery_number_statistics` e
 * `lottery_combination_stats`) — aqui só ordenamos, formatamos e validamos a
 * entrada do usuário. Nenhuma linguagem preditiva: frequência, atraso e
 * ocorrência descrevem o passado.
 */
import type { LotteryConfig } from "@/config/lotteries";
import type { StatisticsSnapshot } from "@/lib/engine/weights";

export interface NumberRow {
  number: number;
  occurrences: number;
  /** Percentual dos concursos analisados em que a dezena saiu (0–100). */
  percentage: number;
  /** Concursos desde a última aparição. */
  drawsSince: number;
}

export const statisticsWindows: { id: string; label: string; value: number | null }[] = [
  { id: "10", label: "Últimos 10", value: 10 },
  { id: "20", label: "Últimos 20", value: 20 },
  { id: "50", label: "Últimos 50", value: 50 },
  { id: "100", label: "Últimos 100", value: 100 },
  { id: "all", label: "Todos", value: null },
];

export function windowOf(value: string | undefined | null): { id: string; value: number | null } {
  const found = statisticsWindows.find((option) => option.id === value);
  const fallback = statisticsWindows.at(-1)!;
  return found ?? { id: fallback.id, value: fallback.value };
}

export function windowLabel(value: string | undefined | null): string {
  const id = windowOf(value).id;
  return statisticsWindows.find((option) => option.id === id)!.label;
}

/** Base de concursos efetivamente analisada no recorte escolhido. */
export function analyzedContests(snapshot: StatisticsSnapshot): number {
  return snapshot.requestedWindow == null
    ? snapshot.contestsAnalyzed
    : Math.min(snapshot.windowContests || snapshot.contestsAnalyzed, snapshot.contestsAnalyzed);
}

export function toNumberRows(snapshot: StatisticsSnapshot): NumberRow[] {
  const base = Math.max(1, analyzedContests(snapshot));
  const useWindow = snapshot.requestedWindow != null;
  return snapshot.numbers.map((row) => {
    const occurrences = useWindow ? row.recentOccurrences : row.totalOccurrences;
    return {
      number: row.number,
      occurrences,
      percentage: (occurrences / base) * 100,
      drawsSince: Math.max(0, row.drawsSinceLastAppearance),
    };
  });
}

/** Mais sorteadas: frequência decrescente; empate resolvido pela dezena. */
export function mostDrawn(rows: NumberRow[], limit?: number): NumberRow[] {
  const sorted = [...rows].sort((a, b) => b.occurrences - a.occurrences || a.number - b.number);
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Menos sorteadas: mesma base, ordem inversa. */
export function leastDrawn(rows: NumberRow[], limit?: number): NumberRow[] {
  const sorted = [...rows].sort((a, b) => a.occurrences - b.occurrences || a.number - b.number);
  return limit ? sorted.slice(0, limit) : sorted;
}

/** Maior atraso: concursos sem aparecer, decrescente. */
export function mostDelayed(rows: NumberRow[], limit?: number): NumberRow[] {
  const sorted = [...rows].sort((a, b) => b.drawsSince - a.drawsSince || a.number - b.number);
  return limit ? sorted.slice(0, limit) : sorted;
}

export function formatPercentage(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export interface CombinationValidation {
  ok: boolean;
  error?: string;
}

/**
 * Validação da combinação escolhida.
 * Ordem não importa; duplicadas não são aceitas; e não faz sentido procurar
 * mais dezenas do que a modalidade sorteia por concurso.
 */
export function validateCombination(
  config: LotteryConfig,
  numbers: number[],
): CombinationValidation {
  if (numbers.length === 0) return { ok: false, error: "Escolha ao menos uma dezena." };

  const outside = numbers.filter(
    (value) =>
      !Number.isInteger(value) || value < config.universe.min || value > config.universe.max,
  );
  if (outside.length > 0) {
    return {
      ok: false,
      error: `A ${config.name} usa dezenas de ${config.universe.min} a ${config.universe.max}.`,
    };
  }

  if (new Set(numbers).size !== numbers.length) {
    return { ok: false, error: "A mesma dezena não pode ser escolhida duas vezes." };
  }

  if (numbers.length > config.selectable.base) {
    return {
      ok: false,
      error: `Um concurso da ${config.name} sorteia ${config.selectable.base} dezenas. Não é possível encontrar um resultado contendo ${numbers.length} dezenas simultaneamente.`,
    };
  }

  return { ok: true };
}
