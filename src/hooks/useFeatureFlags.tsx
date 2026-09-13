import { useQuery } from "@tanstack/react-query";

import {
  defaultFeatureFlags,
  type FeatureKey,
  type FeatureStatus,
} from "@/config/app.config";
import { lotteryDataService } from "@/lib/services/lotteryDataService";

/** Uso restrito à área administrativa; usuários comuns recebem apenas padrões locais. */
export function useFeatureFlags() {
  const query = useQuery({
    queryKey: ["feature-flags"],
    queryFn: () => lotteryDataService.listFeatureFlags(),
    staleTime: 5 * 60 * 1000,
  });

  const flags: Record<string, FeatureStatus> = { ...defaultFeatureFlags };
  for (const row of query.data ?? []) {
    flags[row.key] = row.status as FeatureStatus;
  }

  return {
    ...query,
    flags,
    statusOf: (key: FeatureKey): FeatureStatus => flags[key] ?? defaultFeatureFlags[key],
  };
}
