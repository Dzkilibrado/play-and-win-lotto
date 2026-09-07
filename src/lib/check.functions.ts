/**
 * Ações de conferência automática (RPC tipada).
 *
 * Regra de segurança: o cálculo e a gravação só acontecem no servidor.
 * - o usuário só pode pedir a conferência de um jogo que é dele
 *   (verificado no banco por `owns_game`, não pela interface);
 * - as ações em lote exigem papel ADMIN verificado no banco.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const { data, error } = await (context.supabase as RpcClient).rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ação restrita a administradores.");
}

async function assertOwnsGame(context: { supabase: unknown }, gameId: string) {
  const { data, error } = await (context.supabase as RpcClient).rpc("owns_game", {
    _game_id: gameId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este jogo não pertence a você.");
}

/** Conferência sob demanda de um jogo do próprio usuário. */
export const checkMyGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { gameId: string }) => z.object({ gameId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnsGame(context as never, data.gameId);
    const { getAdminClient, checkSingleGame } = await import("./check/gameCheck.server");
    const admin = await getAdminClient();
    return checkSingleGame(admin, data.gameId);
  });

/** Situação geral da conferência, por modalidade (administração). */
export const getCheckOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { getAdminClient } = await import("./check/gameCheck.server");
    const admin = await getAdminClient();

    const { data: lotteries } = await admin.from("lotteries").select("id, slug, name").order("sort_order");
    const rows = [];
    for (const lottery of lotteries ?? []) {
      const { count: pending } = await admin
        .from("generated_games")
        .select("id", { count: "exact", head: true })
        .eq("lottery_id", lottery.id)
        .in("status", ["BET", "RECEIPTED", "AWAITING_DRAW", "AWAITING_CHECK"]);
      const { count: checked } = await admin
        .from("generated_games")
        .select("id", { count: "exact", head: true })
        .eq("lottery_id", lottery.id)
        .in("status", ["PRIZED", "NOT_PRIZED"]);
      const { count: prized } = await admin
        .from("generated_games")
        .select("id", { count: "exact", head: true })
        .eq("lottery_id", lottery.id)
        .eq("status", "PRIZED");
      const { data: draw } = await admin
        .from("lottery_draws")
        .select("id, contest_number")
        .eq("lottery_id", lottery.id)
        .order("contest_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: job } = await admin
        .from("game_check_jobs")
        .select("id, status, processed, prized, failed, finished_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      rows.push({
        lotteryId: lottery.id,
        slug: lottery.slug,
        name: lottery.name,
        pending: pending ?? 0,
        checked: checked ?? 0,
        prized: prized ?? 0,
        lastContest: draw?.contest_number ?? null,
        lastDrawId: draw?.id ?? null,
        job: job ?? null,
      });
    }
    return rows;
  });

/**
 * Enfileira a conferência de um concurso.
 * Sem `contestNumber`, usa o último concurso oficial da modalidade.
 */
export const startDrawCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string; contestNumber?: number | null }) =>
    z
      .object({ slug: z.string(), contestNumber: z.number().int().positive().nullable().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { getAdminClient, enqueueCheckJob } = await import("./check/gameCheck.server");
    const admin = await getAdminClient();

    const { data: lottery } = await admin
      .from("lotteries")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!lottery) throw new Error("Modalidade não encontrada.");

    let query = admin.from("lottery_draws").select("id, contest_number").eq("lottery_id", lottery.id);
    query = data.contestNumber
      ? query.eq("contest_number", data.contestNumber)
      : query.order("contest_number", { ascending: false }).limit(1);
    const { data: draw } = await query.maybeSingle();
    if (!draw) throw new Error("Concurso não encontrado no banco.");

    const jobId = await enqueueCheckJob(admin, draw.id, (context as { userId: string }).userId);
    return { jobId, contestNumber: draw.contest_number };
  });

/** Avança um lote da fila de conferência. */
export const runCheckBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string; force?: boolean }) =>
    z.object({ jobId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { getAdminClient, runCheckJob } = await import("./check/gameCheck.server");
    const admin = await getAdminClient();
    const job = (await runCheckJob(admin, data.jobId, data.force ?? false)) as unknown as {
      id: string;
      status: string;
      processed: number;
      prized: number;
      failed: number;
    };
    return {
      jobId: job.id,
      status: job.status,
      processed: job.processed,
      prized: job.prized,
      failed: job.failed,
    };
  });

/** Reprocessa a conferência de um concurso já conferido (recalcula tudo). */
export const reprocessDrawCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string; contestNumber?: number | null }) =>
    z
      .object({ slug: z.string(), contestNumber: z.number().int().positive().nullable().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { getAdminClient, loadDrawContext, checkDrawBatch } = await import(
      "./check/gameCheck.server"
    );
    const admin = await getAdminClient();

    const { data: lottery } = await admin
      .from("lotteries")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!lottery) throw new Error("Modalidade não encontrada.");

    let query = admin.from("lottery_draws").select("id").eq("lottery_id", lottery.id);
    query = data.contestNumber
      ? query.eq("contest_number", data.contestNumber)
      : query.order("contest_number", { ascending: false }).limit(1);
    const { data: draw } = await query.maybeSingle();
    if (!draw) throw new Error("Concurso não encontrado no banco.");

    const drawContext = await loadDrawContext(admin, draw.id);
    const since = new Date().toISOString();
    const result = await checkDrawBatch(admin, drawContext, { since });
    return result;
  });

/** Procura concursos recentes com jogos ainda não conferidos. */
export const scanPendingChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { getAdminClient, scanPendingChecks: scan, runOpenCheckJobs } = await import(
      "./check/gameCheck.server"
    );
    const admin = await getAdminClient();
    const queued = await scan(admin);
    const executed = await runOpenCheckJobs(admin, 5);
    return { queued: queued.length, executed };
  });

/** Últimos erros de conferência (administração). */
export const listCheckErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { getAdminClient } = await import("./check/gameCheck.server");
    const admin = await getAdminClient();
    const { data } = await admin
      .from("game_check_errors")
      .select("id, game_id, draw_id, error_type, message, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });
