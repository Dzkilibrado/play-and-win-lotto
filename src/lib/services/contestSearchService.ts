/**
 * Consulta de concursos processada no banco.
 *
 * A base tem mais de 13 mil concursos: busca, filtros, ordenação e paginação
 * acontecem na função `search_draws`; o navegador recebe apenas a página
 * pedida. Continua valendo a regra da arquitetura: o frontend nunca fala com
 * a fonte oficial, só com o nosso banco.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ContestSummary, ContestSituation, ContestSort } from "@/lib/contests/contestSearch";

export interface ContestSearchInput {
  lotterySlug?: string | null;
  contestNumber?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  situation?: ContestSituation | null;
  numbers?: number[] | null;
  sort?: ContestSort;
  page?: number;
  pageSize?: number;
}

export interface ContestSearchResult {
  rows: ContestSummary[];
  total: number;
  page: number;
  pageSize: number;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSearchDraws(raw: unknown): ContestSearchResult {
  const data = (raw ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(data["rows"]) ? (data["rows"] as Record<string, unknown>[]) : [];
  return {
    total: num(data["total"]) ?? 0,
    page: num(data["page"]) ?? 1,
    pageSize: num(data["pageSize"]) ?? 25,
    rows: rows.map((row) => ({
      id: String(row["id"]),
      contestNumber: num(row["contestNumber"]) ?? 0,
      drawDate: (row["drawDate"] as string | null) ?? null,
      isAccumulated: (row["isAccumulated"] as boolean | null) ?? null,
      mainPrize: num(row["mainPrize"]),
      revenue: num(row["revenue"]),
      lotterySlug: (row["lotterySlug"] as string | null) ?? null,
      lotteryName: (row["lotteryName"] as string | null) ?? null,
      colorKey: (row["colorKey"] as string | null) ?? null,
      numbers: Array.isArray(row["numbers"]) ? (row["numbers"] as number[]) : [],
    })),
  };
}

export const contestSearchService = {
  async search(input: ContestSearchInput): Promise<ContestSearchResult> {
    const { data, error } = await supabase.rpc("search_draws" as never, {
      _lottery_slug: input.lotterySlug ?? null,
      _contest: input.contestNumber ?? null,
      _date_from: input.dateFrom ?? null,
      _date_to: input.dateTo ?? null,
      _situation: input.situation ?? null,
      _numbers: input.numbers && input.numbers.length ? input.numbers : null,
      _sort: input.sort ?? "recent",
      _page: input.page ?? 1,
      _page_size: input.pageSize ?? 25,
    } as never);
    if (error) throw error;
    return parseSearchDraws(data);
  },
};
