/** Leituras já feitas: busca e gravação (só identificador e números, sem dados pessoais). */
import { supabase } from "@/integrations/supabase/client";

import type { MysticGame } from "./generator";

export const mysticRulesVersion = 1;

export interface StoredReading {
  fingerprint: string;
  games: MysticGame[];
  createdAt: string;
}

export async function findReading(
  userId: string,
  fingerprint: string,
): Promise<StoredReading | null> {
  const { data, error } = await supabase
    .from("mystic_readings" as never)
    .select("fingerprint, games, created_at" as never)
    .eq("user_id" as never, userId as never)
    .eq("fingerprint" as never, fingerprint as never)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as { fingerprint: string; games: MysticGame[]; created_at: string };
  return { fingerprint: row.fingerprint, games: row.games, createdAt: row.created_at };
}

/** Grava a primeira leitura. Se já existir (corrida entre abas), mantém a original. */
export async function saveReading(input: {
  userId: string;
  fingerprint: string;
  lotterySlug: string;
  games: MysticGame[];
}): Promise<void> {
  const { error } = await supabase.from("mystic_readings" as never).insert({
    user_id: input.userId,
    fingerprint: input.fingerprint,
    lottery_slug: input.lotterySlug,
    games: input.games,
    rules_version: mysticRulesVersion,
  } as never);
  // 23505 = leitura igual já gravada: vale a primeira.
  if (error && (error as { code?: string }).code !== "23505") throw error;
}
