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
    const syncError =
      error instanceof SyncError ? error : new SyncError("UNAVAILABLE", String(error));
    // Auditoria só para os eventos úteis a diagnóstico (não para falhas de rede comuns).
    if (syncError.type === "VALIDATION" || syncError.type === "PERSISTENCE") {
      await logAudit(
        admin,
        null,
        syncError.type === "VALIDATION" ? "sync_validation_failed" : "contest_persist_failed",
        jobId,
        {
          lottery: lottery.slug,
          contest,
          error_type: syncError.type,
          message: syncError.message.slice(0, 300),
        },
      );
    }
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
interface ClaimRow {
  job_id: string;
  lottery_id: string;
  claim_start: number;
  claim_end: number;
  is_final: boolean;
  resumed: boolean;
}

async function readJob(admin: Admin, jobId: string) {
  const { data, error } = await admin
    .from("lottery_sync_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error || !data) {
    throw new SyncError("PERSISTENCE", error?.message ?? "Trabalho não encontrado.");
  }
  return data;
}

export async function runJobBatch(jobId: string, batchSize = syncConfig.batchSize) {
  const admin = await getAdmin();
  const rpc = admin as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  // Reserva atômica da faixa: ninguém mais processa esses concursos.
  const { data: claimData, error: claimError } = await rpc.rpc("claim_sync_job_batch", {
    _job_id: jobId,
    _batch_size: batchSize,
  });
  if (claimError) throw new SyncError("PERSISTENCE", claimError.message);

  const claim = (Array.isArray(claimData) ? (claimData[0] as ClaimRow | undefined) : undefined) ?? null;
  if (!claim) {
    // Job já concluído ou detido por outra execução ativa: encerra limpo.
    const job = await readJob(admin, jobId);
    if (job.status === "running") {
      await logAudit(admin, job.created_by, "job_lock_failed", jobId, {
        reason: "job já está sendo processado por outra execução",
        current_contest: job.current_contest,
      });
    }
    return job;
  }

  const { data: lotteryRow } = await admin
    .from("lotteries")
    .select("id, slug, name")
    .eq("id", claim.lottery_id)
    .single();
  const lottery = (lotteryRow ?? { id: claim.lottery_id, slug: "", name: "" }) as LotteryRow;

  if (claim.resumed) {
    await logAudit(admin, null, "job_resumed", jobId, {
      lottery: lottery.slug,
      from_contest: claim.claim_start,
    });
  }

  const contests: number[] = [];
  for (let contest = claim.claim_start; contest <= claim.claim_end; contest += 1) {
    contests.push(contest);
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  await mapWithConcurrency(contests, syncConfig.concurrency, async (contest) => {
    const result = await syncSingleContest(admin, lottery, contest, jobId);
    if (!result.ok) failed += 1;
    else if (result.outcome === "inserted") inserted += 1;
    else updated += 1;
  });

  const { data: completed, error: completeError } = await rpc.rpc("complete_sync_job_batch", {
    _job_id: jobId,
    _processed: contests.length,
    _inserted: inserted,
    _updated: updated,
    _failed: failed,
    _is_final: claim.is_final,
    _last_error: null,
  });
  if (completeError) throw new SyncError("PERSISTENCE", completeError.message);

  const updatedJob = (completed as Awaited<ReturnType<typeof readJob>>) ?? (await readJob(admin, jobId));

  if (claim.is_final) {
    await logAudit(
      admin,
      updatedJob.created_by,
      updatedJob.type === "HISTORICAL" ? "historical_import_completed" : "sync_completed",
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
