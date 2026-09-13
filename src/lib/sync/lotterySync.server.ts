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
import {
  consistencyCheckAt,
  expectedDrawAt,
  nextPreDrawAction,
  nextRetryAt,
  publicationNeedsAttention,
  waitingStatus,
  type AutomationAction,
  type AutomationStatus,
} from "./automation";
import { fetchOfficialDraw, SyncError, type NormalizedDraw } from "./caixa.provider.server";

type Admin = SupabaseClient<Database>;

export type SyncJobType = Database["public"]["Enums"]["sync_job_type"];

export interface LotteryRow {
  id: string;
  slug: string;
  name: string;
}

type SyncTrigger = "SCHEDULED" | "MANUAL";

interface SyncStateRow {
  lottery_id: string;
  enabled: boolean;
  status: AutomationStatus;
  expected_contest_number: number | null;
  expected_draw_at: string | null;
  consecutive_failures: number;
  next_attempt_at: string | null;
  next_action_kind: AutomationAction;
  consistency_contest_number: number | null;
}

export interface AutomationResult {
  lottery: string;
  attempted: boolean;
  ok: boolean;
  status: AutomationStatus | "LOCKED";
  contest: number | null;
  outcome?: "inserted" | "updated" | "unchanged";
  nextAttemptAt: string | null;
  errorType?: string;
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
): Promise<"inserted" | "updated" | "unchanged"> {
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
  if (data === "inserted" || data === "unchanged") return data;
  return "updated";
}

function publicFailureMessage(type: SyncError["type"]) {
  if (type === "NOT_FOUND") return "Resultado oficial ainda não publicado.";
  if (type === "VALIDATION" || type === "INVALID_RESPONSE") {
    return "A fonte oficial enviou dados que precisam de revisão.";
  }
  if (type === "PERSISTENCE") return "Não foi possível concluir a atualização dos dados.";
  return "A fonte oficial está temporariamente indisponível.";
}

async function ensureSyncState(admin: Admin, lottery: LotteryRow) {
  const { data: state } = await admin
    .from("lottery_sync_state")
    .select("*")
    .eq("lottery_id", lottery.id)
    .maybeSingle();
  if (state) return state as SyncStateRow;

  const { data: latest } = await admin
    .from("lottery_draws")
    .select("next_contest_number, next_draw_date")
    .eq("lottery_id", lottery.id)
    .order("contest_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const expectedAt = expectedDrawAt(latest?.next_draw_date ?? null);
  const now = new Date();
  const next = nextPreDrawAction(now, expectedAt);
  const { data, error } = await admin
    .from("lottery_sync_state")
    .upsert({
      lottery_id: lottery.id,
      status: expectedAt && Date.parse(expectedAt) > now.getTime() ? "WAITING_DRAW" : "WAITING_PUBLICATION",
      expected_contest_number: latest?.next_contest_number ?? null,
      expected_draw_at: expectedAt,
      next_attempt_at: expectedAt && Date.parse(expectedAt) > now.getTime() ? next.at : now.toISOString(),
      next_action_kind: expectedAt && Date.parse(expectedAt) > now.getTime() ? next.action : "WAIT_PUBLICATION",
    })
    .select("*")
    .single();
  if (error) throw new SyncError("PERSISTENCE", error.message);
  return data as SyncStateRow;
}

async function finishAutomationState(
  admin: Admin,
  input: {
    lotteryId: string;
    status: AutomationStatus;
    expectedContest: number | null;
    expectedAt: string | null;
    nextAttemptAt: string | null;
    success: boolean;
    errorType?: string | null;
    errorMessage?: string | null;
    nextActionKind: AutomationAction;
    healthChecked?: boolean;
    consistencyChecked?: boolean;
    consistencyContest?: number | null;
  },
) {
  const { error } = await (admin as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("complete_lottery_sync", {
    _lottery_id: input.lotteryId,
    _status: input.status,
    _expected_contest_number: input.expectedContest,
    _expected_draw_at: input.expectedAt,
    _next_attempt_at: input.nextAttemptAt,
    _success: input.success,
    _error_type: input.errorType ?? null,
    _error_message: input.errorMessage ?? null,
    _next_action_kind: input.nextActionKind,
    _health_checked: input.healthChecked ?? false,
    _consistency_checked: input.consistencyChecked ?? false,
    _consistency_contest_number: input.consistencyContest ?? null,
  });
  if (error) throw new SyncError("PERSISTENCE", error.message);
}

async function createAutomationRun(
  admin: Admin,
  lotteryId: string,
  contest: number | null,
  trigger: SyncTrigger,
  attemptNumber: number,
) {
  const { data, error } = await admin
    .from("lottery_sync_runs")
    .insert({
      lottery_id: lotteryId,
      contest_number: contest,
      trigger_source: trigger,
      status: "RUNNING",
      attempt_number: Math.max(1, attemptNumber),
    })
    .select("id")
    .single();
  if (error) throw new SyncError("PERSISTENCE", error.message);
  return data.id;
}

async function finishAutomationRun(
  admin: Admin,
  runId: string,
  input: {
    status: "SUCCEEDED" | "WAITING" | "FAILED";
    outcome: string;
    nextActionAt: string | null;
    errorType?: string | null;
    errorMessage?: string | null;
  },
) {
  const { error } = await admin
    .from("lottery_sync_runs")
    .update({
      status: input.status,
      outcome: input.outcome,
      finished_at: new Date().toISOString(),
      next_action_at: input.nextActionAt,
      error_type: input.errorType ?? null,
      error_message: input.errorMessage ?? null,
    })
    .eq("id", runId);
  if (error) throw new SyncError("PERSISTENCE", error.message);
}

export function recoveryContestRange(localContest: number, officialContest: number) {
  const start = Math.max(1, localContest + 1);
  const end = Math.min(officialContest, localContest + syncConfig.maxRecoveryContestsPerRun);
  return start <= end ? { start, end } : null;
}

/**
 * Caminho único para agendamento e botão administrativo. A reserva por
 * modalidade evita chamadas simultâneas para o mesmo concurso.
 */
export async function runLotteryAutomation(
  admin: Admin,
  lottery: LotteryRow,
  options: { force?: boolean; trigger?: SyncTrigger; now?: Date } = {},
): Promise<AutomationResult> {
  const force = options.force ?? false;
  const trigger = options.trigger ?? "SCHEDULED";
  const now = options.now ?? new Date();
  const current = await ensureSyncState(admin, lottery);

  const { data: claimed, error: claimError } = await admin.rpc("claim_lottery_sync", {
    _lottery_id: lottery.id,
    _force: force,
  });
  if (claimError) throw new SyncError("PERSISTENCE", claimError.message);
  if (!claimed) {
    return {
      lottery: lottery.slug,
      attempted: false,
      ok: true,
      status: current.status,
      contest: current.expected_contest_number,
      nextAttemptAt: current.next_attempt_at,
    };
  }

  const state = claimed as unknown as SyncStateRow;
  const contest = state.expected_contest_number;
  const runId = await createAutomationRun(
    admin,
    lottery.id,
    contest,
    trigger,
    state.consecutive_failures + 1,
  );

  try {
    const isConsistencyCheck = state.next_action_kind === "CONSISTENCY_CHECK";
    const isCalendarCheck =
      state.next_action_kind === "HEALTH_CHECK" || state.next_action_kind === "PRE_DRAW_CHECK";
    const latest = await fetchOfficialDraw(
      lottery.slug as LotterySlug,
      isConsistencyCheck && state.consistency_contest_number
        ? state.consistency_contest_number
        : undefined,
    );
    if (contest && latest.contestNumber < contest && !isCalendarCheck) {
      throw new SyncError("NOT_FOUND", `Concurso ${contest} ainda não foi publicado.`);
    }
    const { data: localLatest } = await admin
      .from("lottery_draws")
      .select("contest_number")
      .eq("lottery_id", lottery.id)
      .order("contest_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const localContest = localLatest?.contest_number ?? 0;
    const range = recoveryContestRange(localContest, latest.contestNumber);
    let outcome: "inserted" | "updated" | "unchanged" = "unchanged";
    const firstContest = range?.start ?? latest.contestNumber;
    const lastContest = range?.end ?? latest.contestNumber;
    for (let number = firstContest; number <= lastContest; number += 1) {
      const draw = number === latest.contestNumber
        ? latest
        : await fetchOfficialDraw(lottery.slug as LotterySlug, number);
      const persisted = await persistDraw(admin, lottery, draw);
      if (persisted !== "unchanged") outcome = persisted;
    }

    // O cache de estatísticas vive no processo do servidor e precisa ser
    // descartado também quando a atualização veio do agendador.
    const { statisticsService } = await import("@/lib/services/statisticsService");
    statisticsService.invalidate(lottery.slug);

    const recoveryPending = lastContest < latest.contestNumber;
    const expectedContest = recoveryPending
      ? lastContest + 1
      : (latest.nextContestNumber ?? latest.contestNumber + 1);
    const expectedAt = recoveryPending ? now.toISOString() : expectedDrawAt(latest.nextDrawDate);
    const next = recoveryPending
      ? { action: "RETRY" as const, at: now.toISOString() }
      : isConsistencyCheck
        ? nextPreDrawAction(now, expectedAt)
        : isCalendarCheck && contest && latest.contestNumber < contest
          ? nextPreDrawAction(now, expectedAt)
          : { action: "CONSISTENCY_CHECK" as const, at: consistencyCheckAt(now) };
    const status: AutomationStatus = recoveryPending
      ? "WAITING_PUBLICATION"
      : expectedAt && Date.parse(expectedAt) > now.getTime()
        ? "WAITING_DRAW"
        : "UP_TO_DATE";

    await finishAutomationState(admin, {
      lotteryId: lottery.id,
      status,
      expectedContest,
      expectedAt,
      nextAttemptAt: next.at,
      success: true,
      nextActionKind: next.action,
      healthChecked: state.next_action_kind === "HEALTH_CHECK",
      consistencyChecked: isConsistencyCheck,
      consistencyContest:
        isConsistencyCheck || (isCalendarCheck && contest && latest.contestNumber < contest)
          ? null
          : latest.contestNumber,
    });
    await finishAutomationRun(admin, runId, {
      status: "SUCCEEDED",
      outcome: outcome === "updated" && isConsistencyCheck ? "RECTIFICATION_DETECTED" : outcome,
      nextActionAt: next.at,
    });
    await admin
      .from("lottery_sync_errors")
      .update({ resolved_at: now.toISOString() })
      .eq("lottery_id", lottery.id)
      .lte("contest_number", latest.contestNumber)
      .is("resolved_at", null);
    await logAudit(admin, null, "automation_sync_succeeded", lottery.id, {
      lottery: lottery.slug,
      contest: latest.contestNumber,
      next_contest: expectedContest,
      trigger,
      action: state.next_action_kind,
      changed: outcome !== "unchanged",
    });
    if (outcome === "updated" && isConsistencyCheck) {
      await logAudit(admin, null, "official_draw_rectified", lottery.id, {
        lottery: lottery.slug,
        contest: latest.contestNumber,
        checked_at: now.toISOString(),
      });
    }
    return {
      lottery: lottery.slug,
      attempted: true,
      ok: true,
      status,
      contest: latest.contestNumber,
      outcome,
      nextAttemptAt: next.at,
    };
  } catch (error) {
    const syncError = error instanceof SyncError ? error : new SyncError("UNAVAILABLE", String(error));
    await recordError(admin, null, lottery.id, contest, syncError);
    const nextFailureCount = state.consecutive_failures + 1;
    const status = publicationNeedsAttention(now, state.expected_draw_at)
      ? "ATTENTION"
      : waitingStatus(syncError.type, nextFailureCount);
    const retryAt = nextRetryAt(now, state.consecutive_failures, state.expected_draw_at);
    const safeMessage = publicFailureMessage(syncError.type);
    await finishAutomationState(admin, {
      lotteryId: lottery.id,
      status,
      expectedContest: contest,
      expectedAt: state.expected_draw_at,
      nextAttemptAt: retryAt,
      success: false,
      errorType: syncError.type,
      errorMessage: safeMessage,
      nextActionKind: "RETRY",
      consistencyContest: state.consistency_contest_number,
    });
    await finishAutomationRun(admin, runId, {
      status: status === "ATTENTION" ? "FAILED" : "WAITING",
      outcome: syncError.type === "NOT_FOUND" ? "NOT_PUBLISHED" : "RETRY_SCHEDULED",
      nextActionAt: retryAt,
      errorType: syncError.type,
      errorMessage: safeMessage,
    });
    await logAudit(admin, null, "automation_sync_waiting", lottery.id, {
      lottery: lottery.slug,
      contest,
      error_type: syncError.type,
      attempt: nextFailureCount,
      next_attempt_at: retryAt,
      trigger,
    });
    return {
      lottery: lottery.slug,
      attempted: true,
      ok: false,
      status,
      contest,
      nextAttemptAt: retryAt,
      errorType: syncError.type,
    };
  }
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
): Promise<{ ok: boolean; outcome?: "inserted" | "updated" | "unchanged"; contest: number | null }> {
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
