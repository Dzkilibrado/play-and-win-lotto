/**
 * Ações administrativas de sincronização (RPC tipada).
 * Toda função exige sessão autenticada E papel ADMIN verificado no banco —
 * esconder o botão no frontend nunca é a proteção.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LotterySlug } from "@/config/lotteries";

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data, error } = await (
    context.supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
    }
  ).rpc("has_role", { _user_id: context.userId, _role: "ADMIN" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ação restrita a administradores.");
}

export const getSyncOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { getAdminClient, listLotteryRows } = await import("./sync/lotterySync.server");
    const admin = await getAdminClient();
    const lotteries = await listLotteryRows(admin);

    const rows = await Promise.all(
      lotteries.map(async (lottery) => {
        const [{ count }, first, last, job, errors, state, runs] = await Promise.all([
          admin
            .from("lottery_draws")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id),
          admin
            .from("lottery_draws")
            .select("contest_number")
            .eq("lottery_id", lottery.id)
            .order("contest_number", { ascending: true })
            .limit(1)
            .maybeSingle(),
          admin
            .from("lottery_draws")
            .select("contest_number, draw_date, source_updated_at")
            .eq("lottery_id", lottery.id)
            .order("contest_number", { ascending: false })
            .limit(1)
            .maybeSingle(),
          admin
            .from("lottery_sync_jobs")
            .select("*")
            .eq("lottery_id", lottery.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          admin
            .from("lottery_sync_errors")
            .select("id", { count: "exact", head: true })
            .eq("lottery_id", lottery.id)
            .is("resolved_at", null),
          admin
            .from("lottery_sync_state")
            .select("enabled, status, expected_contest_number, expected_draw_at, last_attempt_at, last_success_at, last_error_at, next_attempt_at, next_action_kind, last_health_check_at, last_consistency_check_at, consecutive_failures, last_error_type, last_error_message")
            .eq("lottery_id", lottery.id)
            .maybeSingle(),
          admin
            .from("lottery_sync_runs")
            .select("id, contest_number, trigger_source, status, outcome, attempt_number, started_at, finished_at, next_action_at, error_type, error_message")
            .eq("lottery_id", lottery.id)
            .order("started_at", { ascending: false })
            .limit(5),
        ]);

        return {
          lotteryId: lottery.id,
          slug: lottery.slug,
          name: lottery.name,
          totalContests: count ?? 0,
          firstContest: first.data?.contest_number ?? null,
          lastContest: last.data?.contest_number ?? null,
          lastContestDate: last.data?.draw_date ?? null,
          lastSyncAt: last.data?.source_updated_at ?? null,
          pendingErrors: errors.count ?? 0,
          automation: state.data
            ? {
                enabled: state.data.enabled,
                status: state.data.status,
                expectedContest: state.data.expected_contest_number,
                expectedDrawAt: state.data.expected_draw_at,
                lastAttemptAt: state.data.last_attempt_at,
                lastSuccessAt: state.data.last_success_at,
                lastErrorAt: state.data.last_error_at,
                nextAttemptAt: state.data.next_attempt_at,
                nextActionKind: state.data.next_action_kind,
                lastHealthCheckAt: state.data.last_health_check_at,
                lastConsistencyCheckAt: state.data.last_consistency_check_at,
                consecutiveFailures: state.data.consecutive_failures,
                lastErrorType: state.data.last_error_type,
                lastErrorMessage: state.data.last_error_message,
              }
            : null,
          runs: runs.data ?? [],
          job: job.data
            ? {
                id: job.data.id,
                type: job.data.type,
                status: job.data.status,
                processed: job.data.processed,
                inserted: job.data.inserted,
                updated: job.data.updated,
                failed: job.data.failed,
                currentContest: job.data.current_contest,
                endContest: job.data.end_contest,
                lastError: job.data.last_error,
              }
            : null,
        };
      }),
    );

    return rows;
  });

const startSchema = z.object({
  slug: z.string(),
  type: z.enum(["LATEST", "RECENT", "HISTORICAL", "REPROCESS"]),
});

export const startSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const {
      getAdminClient,
      listLotteryRows,
      createJob,
      syncSingleContest,
      runLotteryAutomation,
      fetchLatestContestNumber,
      runJobBatch,
    } = await import("./sync/lotterySync.server");

    const admin = await getAdminClient();
    const lottery = (await listLotteryRows(admin)).find((item) => item.slug === data.slug);
    if (!lottery) throw new Error("Modalidade não encontrada.");

    if (data.type === "LATEST") {
      const result = await runLotteryAutomation(admin, lottery, {
        force: true,
        trigger: "MANUAL",
      });
      return { kind: "single" as const, ok: result.ok, contest: result.contest };
    }

    const latest = await fetchLatestContestNumber(lottery.slug as LotterySlug);

    if (data.type === "RECENT") {
      const start = Math.max(1, latest - 9);
      const job = await createJob(
        admin,
        lottery,
        "RECENT",
        { start, end: latest },
        context.userId as string,
      );
      const finished = await runJobBatch(job.id);
      return { kind: "job" as const, jobId: job.id, status: finished.status };
    }

    if (data.type === "REPROCESS") {
      const { data: errors } = await admin
        .from("lottery_sync_errors")
        .select("contest_number")
        .eq("lottery_id", lottery.id)
        .is("resolved_at", null)
        .not("contest_number", "is", null)
        .limit(200);
      const contests = [...new Set((errors ?? []).map((row) => row.contest_number!))];
      let ok = 0;
      for (const contest of contests) {
        const result = await syncSingleContest(admin, lottery, contest, null);
        if (result.ok) ok += 1;
      }
      return { kind: "reprocess" as const, attempted: contests.length, ok };
    }

    // HISTORICAL: cria o trabalho em lotes; a execução avança lote a lote.
    const job = await createJob(
      admin,
      lottery,
      "HISTORICAL",
      { start: 1, end: latest },
      context.userId as string,
    );
    return { kind: "job" as const, jobId: job.id, status: job.status };
  });

export const runSyncBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { runJobBatch } = await import("./sync/lotterySync.server");
    const job = await runJobBatch(data.jobId);
    return {
      id: job.id,
      status: job.status,
      processed: job.processed,
      inserted: job.inserted,
      updated: job.updated,
      failed: job.failed,
      currentContest: job.current_contest,
      endContest: job.end_contest,
    };
  });

export const listSyncErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { getAdminClient } = await import("./sync/lotterySync.server");
    const admin = await getAdminClient();
    const { data } = await admin
      .from("lottery_sync_errors")
      .select("id, lottery_id, contest_number, error_type, message, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });
