/**
 * Preferências da tela inicial já resolvidas para uso na interface.
 *
 * A arquitetura não assume três modalidades: as preferências guardam
 * referências às loterias cadastradas, então uma nova modalidade passa a
 * funcionar sem alteração de banco nem de componentes.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  defaultHomeBlocks,
  normalizeHomeBlocks,
  type HomeBlockKey,
  type HomeBlockPreference,
} from "@/config/home.config";
import { getLotteryConfig, type LotteryConfig, type LotterySlug } from "@/config/lotteries";
import { useSession } from "@/hooks/useAuth";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { preferencesService, type PreferencesPatch } from "@/lib/services/preferencesService";

export interface LotteryOption {
  id: string;
  slug: LotterySlug;
  name: string;
  config: LotteryConfig;
}

export function useHomePreferences() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const lotteriesQuery = useQuery({
    queryKey: ["lotteries"],
    queryFn: () => lotteryDataService.listLotteries(),
    staleTime: 5 * 60 * 1000,
  });

  const preferencesQuery = useQuery({
    queryKey: ["user-preferences", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => preferencesService.get(user!.id),
    staleTime: 60 * 1000,
  });

  const lotteries = useMemo<LotteryOption[]>(() => {
    const rows = lotteriesQuery.data ?? [];
    return rows
      .filter((row) => row.is_active)
      .map((row) => {
        const config = getLotteryConfig(row.slug);
        if (!config) return null;
        return { id: row.id, slug: config.slug, name: row.name, config } satisfies LotteryOption;
      })
      .filter((item): item is LotteryOption => item !== null);
  }, [lotteriesQuery.data]);

  const stored = preferencesQuery.data ?? null;

  const followedIds = useMemo(() => {
    const all = lotteries.map((item) => item.id);
    if (!stored || stored.followed_lottery_ids === null) return all;
    const allowed = new Set(all);
    return stored.followed_lottery_ids.filter((id) => allowed.has(id));
  }, [lotteries, stored]);

  const favoriteId = useMemo(() => {
    const id = stored?.favorite_lottery_id ?? null;
    return id && followedIds.includes(id) ? id : null;
  }, [stored, followedIds]);

  /** Acompanhadas na ordem da tela inicial: favorita primeiro. */
  const followedLotteries = useMemo(() => {
    const list = lotteries.filter((item) => followedIds.includes(item.id));
    return list.sort((a, b) => {
      if (a.id === favoriteId) return -1;
      if (b.id === favoriteId) return 1;
      return a.config.sortOrder - b.config.sortOrder;
    });
  }, [lotteries, followedIds, favoriteId]);

  const blocks = useMemo<HomeBlockPreference[]>(
    () => (stored ? normalizeHomeBlocks(stored.home_blocks) : defaultHomeBlocks.map((b) => ({ ...b }))),
    [stored],
  );

  const saveMutation = useMutation({
    mutationFn: (patch: PreferencesPatch) => preferencesService.save(user!.id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-preferences", user?.id] }),
  });

  const resetMutation = useMutation({
    mutationFn: () => preferencesService.reset(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-preferences", user?.id] }),
  });

  const favorite = followedLotteries.find((item) => item.id === favoriteId) ?? null;

  return {
    loading: lotteriesQuery.isLoading || (Boolean(user?.id) && preferencesQuery.isLoading),
    isError: lotteriesQuery.isError || preferencesQuery.isError,
    refetch: () => {
      void lotteriesQuery.refetch();
      void preferencesQuery.refetch();
    },
    lotteries,
    followedIds,
    followedLotteries,
    followedSlugs: followedLotteries.map((item) => item.slug),
    favoriteId,
    favorite,
    favoriteSlug: favorite?.slug ?? null,
    blocks,
    enabledBlocks: blocks.filter((block) => block.enabled).map((block) => block.key as HomeBlockKey),
    save: saveMutation.mutateAsync,
    saving: saveMutation.isPending,
    reset: resetMutation.mutateAsync,
    resetting: resetMutation.isPending,
  };
}
