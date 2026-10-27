/**
 * Atualização leve do calendário do próximo sorteio de TODAS as modalidades
 * (inclusive as desabilitadas). Roda dentro da execução do agendador, sem
 * custo de IA: uma consulta pequena por modalidade, só quando vence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { LotterySlug } from "@/config/lotteries";
import { shouldRefreshNextDraw } from "@/lib/nextDraw/nextDraw";

import { fetchNextDrawInfo, SyncError } from "./caixa.provider.server";

interface LotteryRef {
  id: string;
  slug: string;
}

interface Row {
  lottery_id: string;
  draw_date: string | null;
  fetched_at: string | null;
  last_attempt_at: string | null;
  consecutive_failures: number;
}

export interface NextDrawRefreshResult {
  lottery: string;
  ok: boolean;
  error?: string;
}

// A tabela é nova e `types.ts` é gerado: o acesso é tipado localmente.
type Loose = SupabaseClient<never>;

export async function refreshNextDraws(
  admin: unknown,
  lotteries: LotteryRef[],
  now: Date = new Date(),
): Promise<NextDrawRefreshResult[]> {
  const client = admin as Loose;
  const { data } = await client
    .from("lottery_next_draw" as never)
    .select("lottery_id, draw_date, fetched_at, last_attempt_at, consecutive_failures" as never);
  const byLottery = new Map(((data ?? []) as unknown as Row[]).map((row) => [row.lottery_id, row]));
  const results: NextDrawRefreshResult[] = [];

  for (const lottery of lotteries) {
    const row = byLottery.get(lottery.id) ?? null;
    const due = shouldRefreshNextDraw(
      row && {
        drawDate: row.draw_date,
        fetchedAt: row.fetched_at,
        lastAttemptAt: row.last_attempt_at,
        consecutiveFailures: row.consecutive_failures,
      },
      now,
    );
    if (!due) continue;
    try {
      const info = await fetchNextDrawInfo(lottery.slug as LotterySlug);
      await client.from("lottery_next_draw" as never).upsert({
        lottery_id: lottery.id,
        contest_number: info.nextContestNumber,
        draw_date: info.nextDrawDate,
        estimated_prize: info.estimatedPrize,
        last_contest_number: info.lastContestNumber,
        fetched_at: now.toISOString(),
        last_attempt_at: now.toISOString(),
        consecutive_failures: 0,
        last_error: null,
      } as never);
      results.push({ lottery: lottery.slug, ok: true });
    } catch (error) {
      const message =
        error instanceof SyncError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Falha";
      const failures = (row?.consecutive_failures ?? 0) + 1;
      await client.from("lottery_next_draw" as never).upsert({
        lottery_id: lottery.id,
        fetched_at: row?.fetched_at ?? now.toISOString(),
        last_attempt_at: now.toISOString(),
        consecutive_failures: failures,
        last_error: message.slice(0, 300),
      } as never);
      results.push({ lottery: lottery.slug, ok: false, error: message.slice(0, 120) });
    }
  }
  return results;
}
