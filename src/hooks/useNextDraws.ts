import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  resolveNextDrawView,
  type NextDrawSnapshot,
  type NextDrawView,
} from "@/lib/nextDraw/nextDraw";

interface Row {
  contest_number: number | null;
  draw_date: string | null;
  estimated_prize: number | null;
  fetched_at: string | null;
  lotteries: { slug: string } | null;
}

export const nextDrawsKey = ["next-draws"] as const;

/** Próximo sorteio de todas as modalidades (inclusive desabilitadas), só para informação. */
export async function fetchNextDraws(): Promise<Map<string, NextDrawSnapshot>> {
  const { data, error } = await supabase
    .from("lottery_next_draw" as never)
    .select("contest_number, draw_date, estimated_prize, fetched_at, lotteries(slug)" as never);
  if (error) throw error;
  return new Map(
    ((data ?? []) as unknown as Row[])
      .filter((row) => row.lotteries?.slug)
      .map((row) => [
        row.lotteries!.slug,
        {
          contestNumber: row.contest_number,
          drawDate: row.draw_date,
          estimatedPrize: row.estimated_prize,
          fetchedAt: row.fetched_at,
        },
      ]),
  );
}

export function useNextDraws(fallback?: (slug: string) => NextDrawSnapshot | null) {
  const query = useQuery({ queryKey: nextDrawsKey, queryFn: fetchNextDraws, staleTime: 60_000 });
  return {
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    /** O que mostrar para a modalidade; usa o último resultado salvo se o calendário ainda não foi lido. */
    viewOf: (slug: string): NextDrawView =>
      resolveNextDrawView(query.data?.get(slug) ?? fallback?.(slug) ?? null, new Date()),
  };
}
