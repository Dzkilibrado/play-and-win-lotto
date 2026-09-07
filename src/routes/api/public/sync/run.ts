/**
 * Avanço agendado da sincronização (sem depender de navegador aberto).
 * Protegido por segredo de tarefa agendada — nunca por papel de usuário.
 */
import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/sync/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { getAdminClient, runJobBatch, listLotteryRows, syncSingleContest } = await import(
          "@/lib/sync/lotterySync.server"
        );
        const admin = await getAdminClient();

        // Conferência automática: sempre que esta execução acontece, os
        // concursos recentes com jogos pendentes entram na fila e um lote é
        // processado. Nunca depende de navegador aberto.
        const runChecks = async () => {
          const { scanPendingChecks, runOpenCheckJobs, getAdminClient: adminForChecks } =
            await import("@/lib/check/gameCheck.server");
          const checkAdmin = await adminForChecks();
          const queued = await scanPendingChecks(checkAdmin);
          const executed = await runOpenCheckJobs(checkAdmin, 3);
          return { queued: queued.length, executed };
        };

        // 1) avança trabalhos em andamento; se um estiver detido por outra
        //    execução, tenta o próximo (permite alternar entre modalidades).
        const { data: jobs } = await admin
          .from("lottery_sync_jobs")
          .select("id, current_contest")
          .in("status", ["pending", "running"])
          .order("created_at", { ascending: true })
          .limit(5);

        for (const candidate of jobs ?? []) {
          const before = candidate.current_contest;
          const job = await runJobBatch(candidate.id);
          const advanced = job.current_contest !== before || job.finished_at !== null;
          if (advanced) {
            const checks = await runChecks();
            return Response.json({ mode: "job", jobId: job.id, status: job.status, checks });
          }
        }

        // 2) sem trabalhos pendentes: atualiza o último concurso de cada modalidade
        const lotteries = await listLotteryRows(admin);
        const results = [];
        for (const lottery of lotteries) {
          const result = await syncSingleContest(admin, lottery, null, null);
          results.push({ lottery: lottery.slug, ok: result.ok, contest: result.contest });
        }
        const checks = await runChecks();
        return Response.json({ mode: "latest", results, checks });
      },
    },
  },
});
