/**
 * Leitura da conferência pelo cliente autenticado (RLS do próprio usuário).
 * Nenhum cálculo acontece aqui: o app apenas lê o que o servidor gravou.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PrizeBreakdownRow {
  id: string;
  tier: string;
  hits_required: number;
  winning_combinations: number;
  prize_per_combination: number | null;
  total_for_tier: number | null;
  /**
   * Ganhadores oficiais da faixa, quando a fonte informou.
   * Usado apenas para explicar um valor zero — nunca entra na matemática.
   */
  draw_prizes: { winners: number | null } | null;
}

export interface CheckResultRow {
  id: string;
  game_id: string;
  draw_id: string;
  contest_number: number;
  hits: number;
  matched_numbers: number[];
  is_prized: boolean;
  prize_tier_hits: number | null;
  prize_label: string | null;
  total_prize: number | null;
  amount_pending: boolean;
  calculation_version: number;
  checked_at: string;
  game_prize_breakdown: PrizeBreakdownRow[];
}

const RESULT_SELECT = "*, game_prize_breakdown(*, draw_prizes(winners))";

export const checkService = {
  async getGameCheck(gameId: string) {
    const { data, error } = await supabase
      .from("game_check_results")
      .select(RESULT_SELECT)
      .eq("game_id", gameId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as CheckResultRow | null;
  },

  /** Conferências de vários jogos de uma vez (listas e cards). */
  async getChecksForGames(gameIds: string[]) {
    if (gameIds.length === 0) return new Map<string, CheckResultRow>();
    const { data, error } = await supabase
      .from("game_check_results")
      .select(RESULT_SELECT)
      .in("game_id", gameIds);
    if (error) throw error;
    const map = new Map<string, CheckResultRow>();
    for (const row of (data ?? []) as unknown as CheckResultRow[]) map.set(row.game_id, row);
    return map;
  },

  /** Conferências dos jogos do usuário em um concurso específico. */
  async getChecksForDraw(drawId: string) {
    const { data, error } = await supabase
      .from("game_check_results")
      .select(RESULT_SELECT)
      .eq("draw_id", drawId)
      .order("hits", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as CheckResultRow[];
  },

  /** Resumo para os indicadores do início. */
  async summary() {
    const { data, error } = await supabase
      .from("game_check_results")
      .select("id, is_prized, total_prize, amount_pending");
    if (error) throw error;
    const rows = data ?? [];
    return {
      checked: rows.length,
      prized: rows.filter((row) => row.is_prized).length,
      totalPrize: rows.reduce((sum, row) => sum + Number(row.total_prize ?? 0), 0),
      amountPending: rows.some((row) => row.is_prized && row.amount_pending),
    };
  },
};
