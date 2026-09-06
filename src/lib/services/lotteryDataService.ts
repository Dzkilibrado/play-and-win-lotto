/**
 * Camada única de acesso a dados de loteria.
 *
 * Arquitetura: fonte oficial -> serviço de sincronização -> validação ->
 * PostgreSQL -> app. O frontend consulta SEMPRE o nosso banco; nenhuma
 * chamada a serviço externo acontece aqui.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Lottery, LotteryDraw } from "@/types/domain";

export interface DrawPrizeRow {
  id: string;
  tier: string;
  hits: number;
  winners: number;
  prize_per_winner: number;
}

export interface DrawWithNumbers extends LotteryDraw {
  draw_numbers: { number: number; position: number }[];
  draw_prizes?: DrawPrizeRow[];
  lotteries: Pick<Lottery, "slug" | "name" | "color_key"> | null;
}

export interface ContestFilters {
  lotterySlug?: string | null;
  contestNumber?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  accumulated?: "yes" | "no" | null;
  sort?: "recent" | "oldest" | "prize";
  page?: number;
  pageSize?: number;
}

const DRAW_SELECT = "*, draw_numbers(number, position), lotteries!inner(slug, name, color_key)";

export const lotteryDataService = {
  async listLotteries() {
    const { data, error } = await supabase
      .from("lotteries")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listFeatureFlags() {
    const { data, error } = await supabase.from("feature_flags").select("*");
    if (error) throw error;
    return data ?? [];
  },

  /** Último concurso conhecido de cada modalidade (base do "próximo concurso"). */
  async getLatestDraws() {
    const lotteries = await this.listLotteries();
    const draws = await Promise.all(
      lotteries.map(async (lottery) => {
        const { data, error } = await supabase
          .from("lottery_draws")
          .select(DRAW_SELECT)
          .eq("lottery_id", lottery.id)
          .order("contest_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data as unknown as DrawWithNumbers | null;
      }),
    );
    return draws.filter((draw): draw is DrawWithNumbers => Boolean(draw));
  },

  async listRecentResults(lotterySlug?: string | null, limit = 5) {
    let query = supabase
      .from("lottery_draws")
      .select(DRAW_SELECT)
      .order("contest_number", { ascending: false })
      .limit(limit);
    if (lotterySlug) query = query.eq("lotteries.slug", lotterySlug);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as DrawWithNumbers[];
  },

  async listContests(filters: ContestFilters) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    let query = supabase
      .from("lottery_draws")
      .select(DRAW_SELECT, { count: "exact" })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (filters.lotterySlug) query = query.eq("lotteries.slug", filters.lotterySlug);
    if (filters.contestNumber) query = query.eq("contest_number", filters.contestNumber);
    if (filters.dateFrom) query = query.gte("draw_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("draw_date", filters.dateTo);
    if (filters.accumulated === "yes") query = query.eq("is_accumulated", true);
    if (filters.accumulated === "no") query = query.eq("is_accumulated", false);

    if (filters.sort === "oldest") query = query.order("contest_number", { ascending: true });
    else if (filters.sort === "prize")
      query = query.order("main_prize", { ascending: false, nullsFirst: false });
    else query = query.order("contest_number", { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    return { rows: (data ?? []) as unknown as DrawWithNumbers[], total: count ?? 0, page, pageSize };
  },

  async getContestById(id: string) {
    const { data, error } = await supabase
      .from("lottery_draws")
      .select(
        "*, draw_numbers(number, position), draw_prizes(*), lotteries!inner(slug, name, color_key)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as DrawWithNumbers | null;
  },

  async getContestByNumber(lotterySlug: string, contestNumber: number) {
    const { data, error } = await supabase
      .from("lottery_draws")
      .select(
        "*, draw_numbers(number, position), draw_prizes(*), lotteries!inner(slug, name, color_key)",
      )
      .eq("lotteries.slug", lotterySlug)
      .eq("contest_number", contestNumber)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as DrawWithNumbers | null;
  },

  /** Preço vigente para uma quantidade de dezenas. */
  async getActivePrice(lotteryId: string, numbersSelected: number) {
    const { data, error } = await supabase
      .from("lottery_prices")
      .select("*")
      .eq("lottery_id", lotteryId)
      .eq("numbers_selected", numbersSelected)
      .eq("is_active", true)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listPrices(lotterySlug?: string | null) {
    let query = supabase
      .from("lottery_prices")
      .select("*, lotteries!inner(slug, name)")
      .eq("is_active", true)
      .order("numbers_selected", { ascending: true });
    if (lotterySlug) query = query.eq("lotteries.slug", lotterySlug);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
};
