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

        // 1) avança trabalhos em andamento
        const { data: jobs } = await admin
          .from("lottery_sync_jobs")
          .select("id")
          .in("status", ["pending", "running"])
          .order("created_at", { ascending: true })
          .limit(1);

        if (jobs && jobs.length > 0) {
          const job = await runJobBatch(jobs[0]!.id);
          return Response.json({ mode: "job", jobId: job.id, status: job.status });
        }

        // 2) sem trabalhos pendentes: atualiza o último concurso de cada modalidade
        const lotteries = await listLotteryRows(admin);
        const results = [];
        for (const lottery of lotteries) {
          const result = await syncSingleContest(admin, lottery, null, null);
          results.push({ lottery: lottery.slug, ok: result.ok, contest: result.contest });
        }
        return Response.json({ mode: "latest", results });
      },
    },
  },
});
