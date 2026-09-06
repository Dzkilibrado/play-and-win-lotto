/**
 * Serviço de sincronização: fonte oficial -> validação -> PostgreSQL.
 * Escreve sempre com o cliente administrativo (as tabelas oficiais são
 * somente leitura para qualquer usuário). Nunca apaga dados válidos: um
 * concurso só é reescrito quando a fonte devolve uma resposta válida.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { getLotteryConfig, type LotterySlug } from "@/config/lotteries";
import { syncConfig } from "@/config/sync.config";
import type { Database } from "@/integrations/supabase/types";
import { fetchOfficialDraw, SyncError, type NormalizedDraw } from "./caixa.provider.server";

type Admin = SupabaseClient<Database>;

export type SyncJobType = Database["public"]["Enums"]["sync_job_type"];

export interface LotteryRow {
  id: string;
  slug: string;
  name: string;
}

async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

export async function listLotteryRows(admin: Admin): Promise<LotteryRow[]> {
  const { data, error } = await admin
    .from("lotteries")
    .select("id, slug, name")
    .order("sort_order", { ascending: true });
  if (error) throw new SyncError("PERSISTENCE", error.message);
  return data ?? [];
}

async function logAudit(
  admin: Admin,
  userId: string | null,
  action: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
) {
  await admin.from("audit_logs").insert({
    user_id: userId,
    entity_type: "lottery_sync",
    entity_id: entityId,
    action,
    metadata: metadata as never,
  });
}

/**
 * Persistência atômica por (lottery_id, contest_number).
 * Toda a gravação (concurso + dezenas + faixas) acontece dentro de UMA
 * transação no PostgreSQL, protegida por advisory lock do próprio concurso.
 */
async function persistDraw(
  admin: Admin,
  lottery: LotteryRow,
  draw: NormalizedDraw,
): Promise<"inserted" | "updated"> {
  const { data, error } = await (
    admin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: { message: string } | null }>;
    }
  ).rpc("persist_official_draw", {
    _lottery_id: lottery.id,
    _contest_number: draw.contestNumber,
    _draw: {
      draw_date: draw.drawDate,
      draw_location: draw.drawLocation,
      is_accumulated: draw.isAccumulated,
      main_prize: draw.mainPrize,
      estimated_next_prize: draw.estimatedNextPrize,
      next_contest_number: draw.nextContestNumber,
      next_draw_date: draw.nextDrawDate,
      revenue: draw.revenue,
      source: syncConfig.provider,
    },
    _numbers: draw.numbers.map((number, index) => ({ number, position: index + 1 })),
    _prizes: draw.prizes.map((prize) => ({
      tier: prize.tier,
      hits: prize.hits,
      winners: prize.winners,
      prize_per_winner: prize.prizePerWinner,
    })),
  });

  if (error) throw new SyncError("PERSISTENCE", error.message);
  return data === "inserted" ? "inserted" : "updated";
}

async function recordError(
  admin: Admin,
  jobId: string | null,
  lotteryId: string,
  contestNumber: number | null,
  error: unknown,
) {
  const syncError =
    error instanceof SyncError ? error : new SyncError("UNAVAILABLE", String(error));
  await admin.from("lottery_sync_errors").insert({
    job_id: jobId,
    lottery_id: lotteryId,
    contest_number: contestNumber,
    error_type: syncError.type,
    message: syncError.message.slice(0, 500),
    payload_summary: syncError.payloadSummary?.slice(0, 300) ?? null,
  });
}

/** Sincroniza um único concurso (ou o mais recente quando `contest` é nulo). */
export async function syncSingleContest(
  admin: Admin,
  lottery: LotteryRow,
  contest: number | null,
  jobId: string | null,
): Promise<{ ok: boolean; outcome?: "inserted" | "updated"; contest: number | null }> {
  try {
    const draw = await fetchOfficialDraw(lottery.slug as LotterySlug, contest ?? undefined);
    const outcome = await persistDraw(admin, lottery, draw);
    if (jobId && contest !== null) {
      await admin
        .from("lottery_sync_errors")
        .update({ resolved_at: new Date().toISOString() })
        .eq("lottery_id", lottery.id)
        .eq("contest_number", contest)
        .is("resolved_at", null);
    }
    return { ok: true, outcome, contest: draw.contestNumber };
  } catch (error) {
    await recordError(admin, jobId, lottery.id, contest, error);
    return { ok: false, contest };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += limit) {
    const slice = items.slice(index, index + limit);
    results.push(...(await Promise.all(slice.map(worker))));
  }
  return results;
}

/** Cria um trabalho de sincronização em estado `pending`. */
export async function createJob(
  admin: Admin,
  lottery: LotteryRow,
  type: SyncJobType,
  range: { start: number | null; end: number | null },
  userId: string | null,
) {
  const { data, error } = await admin
    .from("lottery_sync_jobs")
    .insert({
      lottery_id: lottery.id,
      type,
      status: "pending",
      start_contest: range.start,
      end_contest: range.end,
      current_contest: range.start,
      created_by: userId,
    })
    .select("*")
    .single();
  if (error) throw new SyncError("PERSISTENCE", error.message);
  await logAudit(
    admin,
    userId,
    type === "HISTORICAL" ? "historical_import_started" : "sync_started",
    data.id,
    { lottery: lottery.slug, type, ...range },
  );
  return data;
}

/**
 * Executa UM lote do trabalho e devolve o estado atualizado.
 * Chamado repetidamente pela tela administrativa e pelo endpoint agendado,
 * de modo que nenhuma execução dependa de um navegador aberto.
 */
export async function runJobBatch(jobId: string, batchSize = syncConfig.batchSize) {
  const admin = await getAdmin();
  const { data: job, error } = await admin
    .from("lottery_sync_jobs")
    .select("*, lotteries!inner(id, slug, name)")
    .eq("id", jobId)
    .single();
  if (error || !job) throw new SyncError("PERSISTENCE", error?.message ?? "Trabalho não encontrado.");
  if (job.status === "completed" || job.status === "failed" || job.status === "completed_with_errors") {
    return job;
  }

  const lottery = job.lotteries as unknown as LotteryRow;
  const start = job.current_contest ?? job.start_contest ?? 1;
  const end = job.end_contest ?? start;
  const contests: number[] = [];
  for (let contest = start; contest <= end && contests.length < batchSize; contest += 1) {
    contests.push(contest);
  }

  await admin
    .from("lottery_sync_jobs")
    .update({ status: "running", started_at: job.started_at ?? new Date().toISOString() })
    .eq("id", jobId);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  await mapWithConcurrency(contests, syncConfig.concurrency, async (contest) => {
    const result = await syncSingleContest(admin, lottery, contest, jobId);
    if (!result.ok) failed += 1;
    else if (result.outcome === "inserted") inserted += 1;
    else updated += 1;
  });

  const next = contests.length > 0 ? contests[contests.length - 1]! + 1 : end + 1;
  const finished = next > end;
  const totalFailed = job.failed + failed;

  const { data: updatedJob, error: updateError } = await admin
    .from("lottery_sync_jobs")
    .update({
      current_contest: finished ? end : next,
      processed: job.processed + contests.length,
      inserted: job.inserted + inserted,
      updated: job.updated + updated,
      failed: totalFailed,
      status: finished ? (totalFailed > 0 ? "completed_with_errors" : "completed") : "running",
      finished_at: finished ? new Date().toISOString() : null,
    })
    .eq("id", jobId)
    .select("*")
    .single();
  if (updateError) throw new SyncError("PERSISTENCE", updateError.message);

  if (finished) {
    await logAudit(
      admin,
      job.created_by,
      job.type === "HISTORICAL" ? "historical_import_completed" : "sync_completed",
      jobId,
      {
        lottery: lottery.slug,
        processed: updatedJob.processed,
        inserted: updatedJob.inserted,
        updated: updatedJob.updated,
        failed: updatedJob.failed,
      },
    );
  }

  return updatedJob;
}

/** Descobre o número do concurso mais recente na fonte oficial. */
export async function fetchLatestContestNumber(slug: LotterySlug): Promise<number> {
  const draw = await fetchOfficialDraw(slug);
  return draw.contestNumber;
}

export async function getAdminClient() {
  return getAdmin();
}

export { SyncError, logAudit, getLotteryConfig };
