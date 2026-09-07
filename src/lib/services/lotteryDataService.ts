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

  /** Busca de concursos por data (para localizar o concurso de um canhoto/comprovante). */
  async findContestsByDate(lotterySlug: string, date: string) {
    const { data, error } = await supabase
      .from("lottery_draws")
      .select("id, contest_number, draw_date, draw_numbers(number), lotteries!inner(slug)")
      .eq("lotteries.slug", lotterySlug)
      .eq("draw_date", date)
      .order("contest_number", { ascending: true })
      .limit(5);
    if (error) throw error;
    return (data ?? []) as unknown as {
      id: string;
      contest_number: number;
      draw_date: string | null;
      draw_numbers: { number: number }[];
    }[];
  },

  /** Próximo concurso previsto de uma modalidade, conforme o último resultado oficial. */
  async getNextContest(lotterySlug: string) {
    const { data, error } = await supabase
      .from("lottery_draws")
      .select("next_contest_number, next_draw_date, lotteries!inner(slug)")
      .eq("lotteries.slug", lotterySlug)
      .order("contest_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data
      ? { contestNumber: data.next_contest_number, drawDate: data.next_draw_date }
      : null;
  },


  /**
   * Concurso oficial imediatamente anterior a um concurso de referência.
   * Usado pelo filtro "Repetidas do concurso anterior": nunca é o "último
   * sorteio disponível" quando o jogo é para um concurso futuro específico.
   * `before = null` significa "último concurso já sorteado".
   */
  async getPreviousDraw(lotterySlug: string, before: number | null) {
    let query = supabase
      .from("lottery_draws")
      .select("contest_number, draw_numbers(number), lotteries!inner(slug)")
      .eq("lotteries.slug", lotterySlug)
      .order("contest_number", { ascending: false })
      .limit(1);
    if (before != null) query = query.lt("contest_number", before);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    const numbers = (data?.draw_numbers ?? []).map((item) => item.number);
    if (!data || numbers.length === 0) return null;
    return { contestNumber: data.contest_number, numbers };
  },

  /**
   * Situação de um concurso para vincular a um jogo:
   * já sorteado, ainda pendente ou desconhecido pelo nosso banco.
   */
  async resolveContest(lotterySlug: string, contestNumber: number) {
    const draw = await this.getContestByNumber(lotterySlug, contestNumber);
    if (draw) {
      return {
        situation: (draw.draw_numbers?.length ?? 0) > 0 ? ("drawn" as const) : ("pending" as const),
        drawId: draw.id,
        drawDate: draw.draw_date,
      };
    }
    const { data, error } = await supabase
      .from("lottery_draws")
      .select("next_contest_number, next_draw_date, lotteries!inner(slug)")
      .eq("lotteries.slug", lotterySlug)
      .order("contest_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data && data.next_contest_number === contestNumber) {
      return { situation: "pending" as const, drawId: null, drawDate: data.next_draw_date };
    }
    return { situation: "unknown" as const, drawId: null, drawDate: null };
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
