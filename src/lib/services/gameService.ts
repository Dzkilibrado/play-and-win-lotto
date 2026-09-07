/**
 * Persistence Service dos jogos do usuário.
 * Usa SEMPRE o cliente autenticado (RLS do próprio usuário) — nunca service role.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  generationRulesVersion,
  sanitizeFilterStates,
  activeFilterIds,
  type GenerationConstraints,
} from "@/lib/engine/filters";
import type { GameAnalysisResult } from "@/lib/engine/types";
import type { GameOrigin } from "@/lib/games/gameStatus";
import type { GameStatus } from "@/types/domain";

export interface PriceSnapshot {
  priceId: string;
  price: number;
  combinationCount: number;
  source: string | null;
}

export interface SaveGameInput {
  userId: string;
  lotteryId: string;
  numbers: number[];
  analysis: GameAnalysisResult;
  contestNumber: number | null;
  drawId: string | null;
  price: PriceSnapshot | null;
  /** Origem do jogo; padrão é criado pelo aplicativo. */
  source?: GameOrigin;
  status?: GameStatus;
  imagePath?: string | null;
  extraNotes?: string | null;
  /** Snapshot estruturado dos filtros usados na geração deste jogo. */
  constraints?: GenerationConstraints | null;
  /** Estratégia de ponderação usada (sem os pesos individuais). */
  strategy?: StrategySnapshot | null;
}

export interface GameListFilters {
  lotterySlug?: string | null;
  status?: string | null;
  source?: string | null;
  contestNumber?: number | null;
  numbersCount?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  query?: string | null;
  sort?: string | null;
}

const GAME_SELECT =
  "*, game_numbers(number, position), game_analysis(*), lotteries!inner(slug, name, color_key)";

export interface GameRow {
  id: string;
  user_id: string;
  sequence_number: number | null;
  image_path: string | null;
  lottery_id: string;
  contest_number: number | null;
  draw_id: string | null;
  numbers_count: number;
  status: GameStatus;
  cost: number | null;
  notes: string | null;
  source: string;
  created_at: string;
  game_numbers: { number: number; position: number }[];
  generation_constraints: unknown;
  generation_rules_version: number | null;
  game_analysis: GameAnalysisRow[] | GameAnalysisRow | null;
  lotteries: { slug: string; name: string; color_key: string } | null;
}

export interface GameAnalysisRow {
  even_count: number | null;
  odd_count: number | null;
  prime_count: number | null;
  fibonacci_count: number | null;
  sum_total: number | null;
  max_sequence: number | null;
  repeated_from_last: number | null;
  row_distribution: unknown;
  column_distribution: unknown;
}


/** Rastreabilidade do preço aplicado, sem duplicar a tabela de preços. */
function priceNote(price: PriceSnapshot | null, analysis: GameAnalysisResult) {
  const parts: string[] = [];
  if (price) {
    parts.push(
      `preco_ref=${price.priceId}`,
      `preco=${price.price}`,
      `combinacoes=${price.combinationCount}`,
    );
    if (price.source) parts.push(`fonte=${price.source}`);
  }
  parts.push(`salto_maximo=${analysis.maxGap}`);
  if (analysis.comparedToContest) parts.push(`comparado_ao_concurso=${analysis.comparedToContest}`);
  return parts.join("; ");
}

/**
 * Os filtros chegam como parâmetro do usuário: sanitizamos antes de persistir
 * (valores fora de faixa viram nulos) e limitamos o tamanho do registro.
 */
function safeConstraints(constraints: GenerationConstraints | null | undefined) {
  if (!constraints) return null;
  const filters = sanitizeFilterStates(constraints.filters);
  if (!activeFilterIds(filters).length) return null;
  return { version: generationRulesVersion, filters };
}

export const gameService = {
  async saveGame(input: SaveGameInput) {
    const constraints = safeConstraints(input.constraints);
    // O snapshot guarda estratégia, janela, intensidade, coeficientes,
    // referência estatística e hash — nunca os pesos dezena a dezena.
    const strategy = sanitizeStrategySnapshot(input.strategy ?? null);
    const { data: game, error } = await supabase
      .from("generated_games")
      .insert({
        user_id: input.userId,
        lottery_id: input.lotteryId,
        contest_number: input.contestNumber,
        draw_id: input.drawId,
        numbers_count: input.numbers.length,
        status: (input.status ?? "PLANNED") as GameStatus,
        source: input.source ?? "GENERATED",
        image_path: input.imagePath ?? null,
        generation_constraints:
          constraints || strategy
            ? (({
                version: constraints ? constraints.version : generationRulesVersion,
                ...(constraints ? { filters: constraints.filters } : {}),
                ...(strategy ? { strategy } : {}),
              }) as never)
            : null,
        generation_rules_version: constraints || strategy ? generationRulesVersion : null,
        cost: input.price ? input.price.price : null,
        notes: [priceNote(input.price, input.analysis), input.extraNotes]
          .filter(Boolean)
          .join("; "),
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: numbersError } = await supabase.from("game_numbers").insert(
      input.numbers.map((number, index) => ({
        game_id: game.id,
        number,
        position: index + 1,
      })),
    );
    if (numbersError) throw numbersError;

    const { error: analysisError } = await supabase.from("game_analysis").insert({
      game_id: game.id,
      even_count: input.analysis.evenCount,
      odd_count: input.analysis.oddCount,
      prime_count: input.analysis.primeCount,
      fibonacci_count: input.analysis.fibonacciCount,
      sum_total: input.analysis.sumTotal,
      max_sequence: input.analysis.maxSequence,
      repeated_from_last: input.analysis.repeatedFromLast,
      row_distribution: input.analysis.rowDistribution as never,
      column_distribution: input.analysis.columnDistribution as never,
    });
    if (analysisError) throw analysisError;

    return game.id;
  },

  async listGames(filters: GameListFilters) {
    let query = supabase.from("generated_games").select(GAME_SELECT, { count: "exact" });

    if (filters.lotterySlug) query = query.eq("lotteries.slug", filters.lotterySlug);
    if (filters.status) query = query.eq("status", filters.status as GameStatus);
    if (filters.source) query = query.eq("source", filters.source);
    if (filters.contestNumber) query = query.eq("contest_number", filters.contestNumber);
    if (filters.numbersCount) query = query.eq("numbers_count", filters.numbersCount);
    if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00Z`);
    if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59Z`);

    if (filters.sort === "oldest") query = query.order("created_at", { ascending: true });
    else if (filters.sort === "contest")
      query = query.order("contest_number", { ascending: false, nullsFirst: false });
    else query = query.order("created_at", { ascending: false });

    const { data, error, count } = await query;
    if (error) throw error;
    return { rows: (data ?? []) as unknown as GameRow[], total: count ?? 0 };
  },

  /** Contadores por situação para os indicadores clicáveis do início. */
  async statusCounts() {
    const { data, error } = await supabase.from("generated_games").select("status");
    if (error) throw error;
    const counts: Partial<Record<GameStatus, number>> = {};
    for (const row of data ?? []) {
      const status = row.status as GameStatus;
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return { counts, total: (data ?? []).length };
  },

  async getGame(id: string) {
    const { data, error } = await supabase
      .from("generated_games")
      .select(GAME_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as GameRow | null;
  },

  async updateStatus(id: string, status: GameStatus) {
    // Conferência automática é etapa futura: aqui só o próprio usuário move a situação.
    const { error } = await supabase.from("generated_games").update({ status }).eq("id", id);
    if (error) throw error;
  },

  async deleteGame(id: string) {
    // RLS garante que só o dono apaga; o status é conferido também no cliente.
    const { error } = await supabase
      .from("generated_games")
      .delete()
      .eq("id", id)
      .in("status", ["PLANNED", "BET", "RECEIPTED", "AWAITING_DRAW", "AWAITING_CHECK"]);
    if (error) throw error;
  },

  /**
   * Link temporário e privado para a imagem do jogo (canhoto/comprovante).
   * O bucket permanece privado: nada é publicado de forma permanente.
   */
  async getImageUrl(imagePath: string, expiresInSeconds = 300) {
    const { data, error } = await supabase.storage
      .from("game-imports")
      .createSignedUrl(imagePath, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  },
};

