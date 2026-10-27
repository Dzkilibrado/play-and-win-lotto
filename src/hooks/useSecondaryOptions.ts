import { useQuery } from "@tanstack/react-query";

import { getLotteryConfig, type SecondaryOption } from "@/config/lotteries";
import { lotteryDataService } from "@/lib/services/lotteryDataService";

/**
 * Opções da seleção secundária da modalidade (Mês da Sorte, Time do Coração).
 * `supported` = a modalidade tem seleção extra (mês, clube ou trevos).
 * Mês vem da configuração; clubes vêm do catálogo no banco.
 */
export function useSecondaryOptions(slug: string | undefined, lotteryId: string | undefined) {
  const config = slug ? getLotteryConfig(slug as never) : undefined;
  const secondary = config?.secondary;
  const supported = !!secondary;
  const fromCatalog = supported && !secondary.options;

  const catalog = useQuery({
    queryKey: ["secondary-options", lotteryId],
    queryFn: () => lotteryDataService.getSecondaryOptions(lotteryId!),
    enabled: fromCatalog && !!lotteryId,
    staleTime: 5 * 60_000,
  });

  const options: SecondaryOption[] = secondary?.options ?? catalog.data ?? [];
  return {
    supported,
    label: secondary?.label ?? null,
    kind: secondary?.kind ?? null,
    /** Quantas escolhas o jogo precisa ter (1 para mês/time; 2 a 6 trevos). */
    minSelect: secondary?.selectable.min ?? 0,
    maxSelect: secondary?.selectable.max ?? 0,
    options,
    isLoading: fromCatalog && catalog.isLoading,
  };
}
