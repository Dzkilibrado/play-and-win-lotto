/**
 * Regras puras da tela "Concursos e Resultados".
 *
 * Toda a filtragem/ordenação/paginação acontece no banco (função
 * `search_draws`). Aqui ficam apenas os rótulos, a validação dos parâmetros
 * vindos da URL e a conversão para o formato exibido.
 */
import type { DrawWithNumbers } from "@/lib/services/lotteryDataService";

export interface ContestSummary {
  id: string;
  contestNumber: number;
  drawDate: string | null;
  isAccumulated: boolean | null;
  mainPrize: number | null;
  revenue: number | null;
  lotterySlug: string | null;
  lotteryName: string | null;
  colorKey: string | null;
  numbers: number[];
}

export type ContestSort = "recent" | "oldest" | "prize_desc" | "prize_asc" | "revenue_desc";

export const contestSortOptions: { id: ContestSort; label: string }[] = [
  { id: "recent", label: "Mais recentes" },
  { id: "oldest", label: "Mais antigos" },
  { id: "prize_desc", label: "Maior prêmio principal" },
  { id: "prize_asc", label: "Menor prêmio principal" },
  { id: "revenue_desc", label: "Maior arrecadação" },
];

export function contestSortOf(value: string | undefined | null): ContestSort {
  const found = contestSortOptions.find((option) => option.id === value);
  return found ? found.id : "recent";
}

export function contestSortLabel(value: string | undefined | null): string {
  return contestSortOptions.find((option) => option.id === contestSortOf(value))!.label;
}

export type ContestSituation = "done" | "pending" | "accumulated" | "winner";

export const contestSituationOptions: { id: ContestSituation; label: string }[] = [
  { id: "done", label: "Realizado" },
  { id: "pending", label: "Próximo/previsto" },
  { id: "accumulated", label: "Acumulou" },
  { id: "winner", label: "Com ganhador principal" },
];

export function contestSituationOf(value: string | undefined | null): ContestSituation | null {
  const found = contestSituationOptions.find((option) => option.id === value);
  return found ? found.id : null;
}

export function contestSituationLabel(value: string | undefined | null): string | null {
  const id = contestSituationOf(value);
  return id ? contestSituationOptions.find((option) => option.id === id)!.label : null;
}

export const contestPageSizes = [10, 25, 50, 100] as const;
export const defaultContestPageSize = 25;

export function contestPageSizeOf(value: string | number | undefined | null): number {
  const parsed = Number(value);
  return (contestPageSizes as readonly number[]).includes(parsed) ? parsed : defaultContestPageSize;
}

/** "5,17,23" -> [5, 17, 23]; ignora vazios, duplicadas e valores inválidos. */
export function parseNumbersParam(value: string | undefined | null): number[] {
  if (!value) return [];
  const seen = new Set<number>();
  for (const part of value.split(/[,\s.+-]+/)) {
    const parsed = Number(part);
    if (!Number.isInteger(parsed) || parsed <= 0) continue;
    seen.add(parsed);
  }
  return [...seen].sort((a, b) => a - b);
}

export function serializeNumbers(numbers: number[]): string | undefined {
  const unique = [...new Set(numbers)].sort((a, b) => a - b);
  return unique.length ? unique.join(",") : undefined;
}

export function formatNumbersLabel(numbers: number[]): string {
  return numbers.map((value) => String(value).padStart(2, "0")).join(" · ");
}

export function toContestSummary(draw: DrawWithNumbers): ContestSummary {
  return {
    id: draw.id,
    contestNumber: draw.contest_number,
    drawDate: draw.draw_date ?? null,
    isAccumulated: draw.is_accumulated ?? null,
    mainPrize: draw.main_prize == null ? null : Number(draw.main_prize),
    revenue: draw.revenue == null ? null : Number(draw.revenue),
    lotterySlug: draw.lotteries?.slug ?? null,
    lotteryName: draw.lotteries?.name ?? null,
    colorKey: draw.lotteries?.color_key ?? null,
    numbers: [...(draw.draw_numbers ?? [])].map((item) => item.number).sort((a, b) => a - b),
  };
}
