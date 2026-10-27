import { useQuery } from "@tanstack/react-query";

import type { LotteryAvailability } from "@/config/lotteries";
import { supabase } from "@/integrations/supabase/client";
import {
  availabilityOf,
  buildAvailabilityMap,
  enabledLotteries,
  visibleLotteries,
  type AvailabilityMap,
  type AvailabilityRow,
} from "@/lib/lotteryAvailability";

export const lotteryAvailabilityKey = ["lottery-availability"] as const;

/** Leitura pública (a tabela `lotteries` é de leitura aberta). Falha = tudo habilitado; o banco continua travando. */
export async function fetchLotteryAvailability(): Promise<AvailabilityMap> {
  try {
    const { data, error } = await supabase
      .from("lotteries")
      .select("slug, availability, availability_note" as never);
    if (error) return buildAvailabilityMap([]);
    return buildAvailabilityMap((data ?? []) as unknown as AvailabilityRow[]);
  } catch {
    return buildAvailabilityMap([]);
  }
}

/** Disponibilidade das modalidades para a interface. */
export function useLotteryAvailability() {
  const query = useQuery({
    queryKey: lotteryAvailabilityKey,
    queryFn: fetchLotteryAvailability,
    staleTime: 30_000,
  });
  const map: AvailabilityMap = query.data ?? buildAvailabilityMap([]);
  return {
    isLoading: query.isLoading,
    availabilityOf: (slug: string): LotteryAvailability => availabilityOf(map, slug),
    noteOf: (slug: string): string | null => map.get(slug)?.note ?? null,
    /** Onde o usuário pode criar jogos e bolões. */
    enabledLotteries: enabledLotteries(map),
    /** Listas, filtros e consultas (habilitadas + em manutenção). */
    visibleLotteries: visibleLotteries(map),
  };
}
