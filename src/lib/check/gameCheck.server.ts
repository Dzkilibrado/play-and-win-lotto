/**
 * Serviço de conferência automática (somente servidor).
 *
 * Fluxo: resultado oficial já validado no PostgreSQL -> seleção dos jogos do
 * concurso -> motor puro de conferência -> gravação atômica via
 * `apply_game_check`. O navegador nunca calcula nem grava conferência.
 *
 * Garantias:
 * - idempotente: conferir de novo o mesmo jogo produz o mesmo resultado;
 * - resiliente: a falha de um jogo é registrada e não interrompe os demais;
 * - retomável: processa em lotes com fila (`game_check_jobs`);
 * - nunca confere concurso sem dezenas oficiais.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { checkConfig } from "@/config/check.config";
import { getLotteryConfig, type LotterySlug } from "@/config/lotteries";
import type { Database } from "@/integrations/supabase/types";
import { CheckError, checkGame, type OfficialTier } from "./checkEngine";

type Admin = SupabaseClient<Database>;

type Rpc = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function getAdminClient(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

export interface DrawContext {
  drawId: string;
  lotteryId: string;
  slug: string;
  contestNumber: number;
  drawNumbers: number[];
  baseSize: number;
  tiers: OfficialTier[];
  sourceUpdatedAt: string | null;
  tiersFromOfficialSource: boolean;
}

/** Contexto oficial do concurso: dezenas, faixas e data da última atualização. */
export async function loadDrawContext(admin: Admin, drawId: string): Promise<DrawContext> {
  const { data, error } = await admin
    .from("lottery_draws")
    .select(
      "id, lottery_id, contest_number, source_updated_at, draw_numbers(number), draw_prizes(id, tier, hits, prize_per_winner), lotteries!inner(slug)",
    )
    .eq("id", drawId)
    .maybeSingle();
  if (error) throw new CheckError("NO_DRAW_NUMBERS", error.message);
  if (!data) throw new CheckError("NO_DRAW_NUMBERS", "Concurso não encontrado.");

  const row = data as unknown as {
    id: string;
    lottery_id: string;
    contest_number: number;
    source_updated_at: string | null;
    draw_numbers: { number: number }[];
    draw_prizes: { id: string; tier: string; hits: number; prize_per_winner: number | null }[];
    lotteries: { slug: string } | null;
  };

  const drawNumbers = (row.draw_numbers ?? []).map((item) => item.number);
  if (drawNumbers.length === 0) {
    throw new CheckError("NO_DRAW_NUMBERS", "Concurso ainda sem dezenas oficiais.");
  }

  const slug = row.lotteries?.slug ?? "";
  const config = getLotteryConfig(slug as LotterySlug);
  if (!config) throw new CheckError("LOTTERY_MISMATCH", `Modalidade desconhecida: ${slug}`);

  const official = row.draw_prizes ?? [];
  // Sem faixas oficiais gravadas, usamos apenas os rótulos configurados da
  // modalidade — e sem valor: o app nunca inventa um prêmio.
  const tiers: OfficialTier[] = official.length
    ? official.map((prize) => ({
        drawPrizeId: prize.id,
        tier: prize.tier,
        hits: prize.hits,
        prizePerWinner: prize.prize_per_winner,
      }))
    : config.prizeTiers.map((tier) => ({
        drawPrizeId: null,
        tier: tier.label,
        hits: tier.hits,
        prizePerWinner: null,
      }));

  return {
    drawId: row.id,
    lotteryId: row.lottery_id,
    slug,
    contestNumber: row.contest_number,
    drawNumbers,
    baseSize: config.selectable.base,
    tiers,
    sourceUpdatedAt: row.source_updated_at,
    tiersFromOfficialSource: official.length > 0,
  };
}

interface GameRow {
  id: string;
  status: string;
  game_numbers: { number: number }[];
  game_check_results:
    | { checked_at: string; calculation_version: number; source_updated_at: string | null }[]
    | null;
}

/** Situações elegíveis: um jogo apenas planejado nunca é conferido. */
const eligibleStatuses = [
  "BET",
  "RECEIPTED",
  "AWAITING_DRAW",
  "AWAITING_CHECK",
  "CHECKED",
  "PRIZED",
  "NOT_PRIZED",
] as const;

function needsCheck(game: GameRow, context: DrawContext, since: string | null): boolean {
  const result = game.game_check_results?.[0];
  if (!result) return true;
  if (result.calculation_version !== checkConfig.calculationVersion) return true;
  // Concurso alterado na fonte depois da conferência: reconferir.
  if ((result.source_updated_at ?? null) !== (context.sourceUpdatedAt ?? null)) return true;
  if (since && result.checked_at < since) return true;
  return false;
}

async function recordCheckError(
  admin: Admin,
  jobId: string | null,
  gameId: string | null,
  drawId: string,
  error: unknown,
) {
  const type = error instanceof CheckError ? error.type : "UNEXPECTED";
  const message = error instanceof Error ? error.message : String(error);
  await admin.from("game_check_errors").insert({
    game_id: gameId,
    draw_id: drawId,
    job_id: jobId,
    error_type: type,
    message: message.slice(0, 500),
  } as never);
}

export interface CheckBatchResult {
  processed: number;
  prized: number;
  failed: number;
  remaining: number;
  contestNumber: number;
}

/**
 * Confere um lote de jogos de um concurso.
 * `since` (opcional) força reconferência dos resultados anteriores a esse
 * instante — usado pelo reprocessamento administrativo.
 */
export async function checkDrawBatch(
  admin: Admin,
  context: DrawContext,
  options: { jobId?: string | null; since?: string | null; limit?: number } = {},
): Promise<CheckBatchResult> {
  const limit = options.limit ?? checkConfig.batchSize;
  const jobId = options.jobId ?? null;
  const since = options.since ?? null;
  const deadline = Date.now() + checkConfig.maxBatchDurationMs;

  await (admin as unknown as Rpc).rpc("mark_games_awaiting_check", { _draw_id: context.drawId });

  let processed = 0;
  let prized = 0;
  let failed = 0;
  let remaining = 0;
  let offset = 0;
  const pageSize = 500;

  for (;;) {
    const { data, error } = await admin
      .from("generated_games")
      .select(
        "id, status, game_numbers(number), game_check_results(checked_at, calculation_version, source_updated_at)",
      )
      .eq("lottery_id", context.lotteryId)
      .eq("contest_number", context.contestNumber)
      .in("status", eligibleStatuses)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new CheckError("NO_DRAW_NUMBERS", error.message);

    const rows = (data ?? []) as unknown as GameRow[];
    if (rows.length === 0) break;
    offset += rows.length;

    for (const game of rows) {
      if (!needsCheck(game, context, since)) continue;
      if (processed >= limit || Date.now() > deadline) {
        remaining += 1;
        continue;
      }
      try {
        const outcome = checkGame({
          gameNumbers: (game.game_numbers ?? []).map((item) => item.number),
          drawNumbers: context.drawNumbers,
          baseSize: context.baseSize,
          tiers: context.tiers,
        });
        const { error: rpcError } = await (admin as unknown as Rpc).rpc("apply_game_check", {
          _game_id: game.id,
          _draw_id: context.drawId,
          _payload: {
            contest_number: context.contestNumber,
            hits: outcome.hits,
            matched_numbers: outcome.matchedNumbers,
            is_prized: outcome.isPrized,
            prize_tier_hits: outcome.prizeTierHits,
            prize_label: outcome.prizeLabel,
            total_prize: outcome.totalPrize,
            amount_pending: outcome.amountPending,
            calculation_version: outcome.calculationVersion,
            source_updated_at: context.sourceUpdatedAt,
            breakdown: outcome.breakdown.map((entry) => ({
              draw_prize_id: entry.drawPrizeId,
              tier: entry.tier,
              hits_required: entry.hitsRequired,
              winning_combinations: entry.winningCombinations,
              prize_per_combination: entry.prizePerCombination,
              total_for_tier: entry.totalForTier,
            })),
          },
        });
        if (rpcError) throw new Error(rpcError.message);
        processed += 1;
        if (outcome.isPrized) prized += 1;
      } catch (checkFailure) {
        failed += 1;
        await recordCheckError(admin, jobId, game.id, context.drawId, checkFailure);
      }
    }

    if (rows.length < pageSize) break;
  }

  return { processed, prized, failed, remaining, contestNumber: context.contestNumber };
}

/** Confere um único jogo (ação do próprio usuário ou reprocessamento pontual). */
export async function checkSingleGame(admin: Admin, gameId: string) {
  const { data, error } = await admin
    .from("generated_games")
    .select("id, status, contest_number, lottery_id, game_numbers(number), lotteries!inner(slug)")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new CheckError("INVALID_GAME", error.message);
  if (!data) throw new CheckError("INVALID_GAME", "Jogo não encontrado.");

  const game = data as unknown as {
    id: string;
    status: string;
    contest_number: number | null;
    lottery_id: string;
    game_numbers: { number: number }[];
    lotteries: { slug: string } | null;
  };

  if (game.status === "PLANNED") {
    return { ok: false as const, reason: "planned" as const };
  }
  if (!game.contest_number) {
    return { ok: false as const, reason: "no_contest" as const };
  }

  const { data: drawRow } = await admin
    .from("lottery_draws")
    .select("id")
    .eq("lottery_id", game.lottery_id)
    .eq("contest_number", game.contest_number)
    .maybeSingle();
  if (!drawRow) return { ok: false as const, reason: "draw_missing" as const };

  let context: DrawContext;
  try {
    context = await loadDrawContext(admin, drawRow.id);
  } catch (failure) {
    if (failure instanceof CheckError && failure.type === "NO_DRAW_NUMBERS") {
      return { ok: false as const, reason: "not_drawn" as const };
    }
    throw failure;
  }

  try {
    const outcome = checkGame({
      gameNumbers: (game.game_numbers ?? []).map((item) => item.number),
      drawNumbers: context.drawNumbers,
      baseSize: context.baseSize,
      tiers: context.tiers,
    });
    const { error: rpcError } = await (admin as unknown as Rpc).rpc("apply_game_check", {
      _game_id: game.id,
      _draw_id: context.drawId,
      _payload: {
        contest_number: context.contestNumber,
        hits: outcome.hits,
        matched_numbers: outcome.matchedNumbers,
        is_prized: outcome.isPrized,
        prize_tier_hits: outcome.prizeTierHits,
        prize_label: outcome.prizeLabel,
        total_prize: outcome.totalPrize,
        amount_pending: outcome.amountPending,
        calculation_version: outcome.calculationVersion,
        source_updated_at: context.sourceUpdatedAt,
        breakdown: outcome.breakdown.map((entry) => ({
          draw_prize_id: entry.drawPrizeId,
          tier: entry.tier,
          hits_required: entry.hitsRequired,
          winning_combinations: entry.winningCombinations,
          prize_per_combination: entry.prizePerCombination,
          total_for_tier: entry.totalForTier,
        })),
      },
    });
    if (rpcError) throw new Error(rpcError.message);
    return { ok: true as const, hits: outcome.hits, isPrized: outcome.isPrized };
  } catch (failure) {
    await recordCheckError(admin, null, game.id, context.drawId, failure);
    throw failure;
  }
}

/** Cria (ou reaproveita) a fila de conferência de um concurso. */
export async function enqueueCheckJob(admin: Admin, drawId: string, createdBy: string | null) {
  const { data: open } = await admin
    .from("game_check_jobs")
    .select("id")
    .eq("draw_id", drawId)
    .in("status", ["pending", "running"])
    .maybeSingle();
  if (open) return open.id as string;

  const { data, error } = await admin
    .from("game_check_jobs")
    .insert({ draw_id: drawId, created_by: createdBy } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Avança uma fila de conferência em um lote. */
export async function runCheckJob(admin: Admin, jobId: string, force = false) {
  const { data: job, error } = await admin
    .from("game_check_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) throw new Error("Fila de conferência não encontrada.");
  const row = job as unknown as {
    id: string;
    draw_id: string;
    status: string;
    processed: number;
    prized: number;
    failed: number;
    started_at: string | null;
  };
  if (["completed", "completed_with_errors", "failed"].includes(row.status)) return row;

  // Reserva atômica: só uma execução assume a fila. Uma fila que ficou
  // `running` sem atividade (queda/timeout) volta a ser assumível depois do
  // prazo de recuperação — nunca fica travada para sempre.
  const { data: claimed, error: claimError } = await (admin as unknown as Rpc).rpc(
    "claim_check_job",
    { _job_id: jobId, _stale_after: checkConfig.jobStaleAfter },
  );
  if (claimError) throw new Error(claimError.message);
  if (claimed !== true) return row;

  const startedAt = row.started_at ?? new Date().toISOString();

  try {
    const context = await loadDrawContext(admin, row.draw_id);
    const result = await checkDrawBatch(admin, context, {
      jobId,
      since: force ? startedAt : null,
    });
    const finished = result.remaining === 0;
    const failedTotal = row.failed + result.failed;
    const { data: updated } = await admin
      .from("game_check_jobs")
      .update({
        processed: row.processed + result.processed,
        prized: row.prized + result.prized,
        failed: failedTotal,
        status: finished
          ? failedTotal > 0
            ? "completed_with_errors"
            : "completed"
          : "running",
        finished_at: finished ? new Date().toISOString() : null,
      } as never)
      .eq("id", jobId)
      .select("*")
      .single();

    if (finished) {
      await admin.from("audit_logs").insert({
        user_id: null,
        entity_type: "game_check",
        entity_id: row.draw_id,
        action: "check_completed",
        metadata: {
          contest_number: result.contestNumber,
          processed: row.processed + result.processed,
          prized: row.prized + result.prized,
          failed: failedTotal,
        } as never,
      });
    }
    return (updated ?? row) as never;
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    await recordCheckError(admin, jobId, null, row.draw_id, failure);
    const { data: updated } = await admin
      .from("game_check_jobs")
      .update({
        status: "failed",
        last_error: message.slice(0, 500),
        finished_at: new Date().toISOString(),
      } as never)
      .eq("id", jobId)
      .select("*")
      .single();
    return (updated ?? row) as never;
  }
}

/**
 * Varredura automática usada pela execução agendada: procura concursos
 * recentes já sorteados com jogos pendentes de conferência e os enfileira.
 */
export async function scanPendingChecks(admin: Admin) {
  const { data: lotteries } = await admin.from("lotteries").select("id, slug");
  const queued: { slug: string; contestNumber: number; jobId: string }[] = [];

  for (const lottery of lotteries ?? []) {
    const { data: draws } = await admin
      .from("lottery_draws")
      .select("id, contest_number")
      .eq("lottery_id", lottery.id)
      .order("contest_number", { ascending: false })
      .limit(checkConfig.recentDrawsToScan);

    for (const draw of draws ?? []) {
      const { count } = await admin
        .from("generated_games")
        .select("id", { count: "exact", head: true })
        .eq("lottery_id", lottery.id)
        .eq("contest_number", draw.contest_number)
        .in("status", ["BET", "RECEIPTED", "AWAITING_DRAW", "AWAITING_CHECK"]);
      if (!count) continue;
      const jobId = await enqueueCheckJob(admin, draw.id, null);
      queued.push({ slug: lottery.slug, contestNumber: draw.contest_number, jobId });
    }
  }
  return queued;
}

/** Executa até `max` lotes de filas abertas (execução agendada). */
export async function runOpenCheckJobs(admin: Admin, max = 3) {
  const { data: jobs } = await admin
    .from("game_check_jobs")
    .select("id")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: true })
    .limit(max);

  const results = [];
  for (const job of jobs ?? []) {
    const updated = (await runCheckJob(admin, job.id)) as unknown as {
      id: string;
      status: string;
      processed: number;
      prized: number;
    };
    results.push({
      jobId: updated.id,
      status: updated.status,
      processed: updated.processed,
      prized: updated.prized,
    });
  }
  return results;
}
