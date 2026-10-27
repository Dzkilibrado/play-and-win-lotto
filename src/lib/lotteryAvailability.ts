/**
 * Regras puras de disponibilidade das modalidades (sem rede, sem React).
 * A trava definitiva está no banco; aqui só se decide o que a interface mostra.
 */
import {
  activeLotteries,
  type LotteryAvailability,
  type LotteryConfig,
  type LotterySlug,
} from "@/config/lotteries";

export interface AvailabilityRow {
  slug: string;
  availability: string | null;
  availability_note: string | null;
}

export interface AvailabilityEntry {
  availability: LotteryAvailability;
  note: string | null;
}

export type AvailabilityMap = ReadonlyMap<string, AvailabilityEntry>;

export function parseAvailability(value: unknown): LotteryAvailability {
  return value === "MAINTENANCE" || value === "DISABLED" ? value : "ENABLED";
}

export function buildAvailabilityMap(rows: readonly AvailabilityRow[]): AvailabilityMap {
  return new Map(
    rows.map((row) => [
      row.slug,
      { availability: parseAvailability(row.availability), note: row.availability_note ?? null },
    ]),
  );
}

export function availabilityOf(map: AvailabilityMap, slug: string): LotteryAvailability {
  return map.get(slug)?.availability ?? "ENABLED";
}

/** Modalidades em que o usuário pode criar jogos e bolões. */
export function enabledLotteries(
  map: AvailabilityMap,
  lotteries: readonly LotteryConfig[] = activeLotteries,
): LotteryConfig[] {
  return lotteries.filter((lottery) => availabilityOf(map, lottery.slug) === "ENABLED");
}

/** Modalidades que aparecem para o usuário (habilitadas e em manutenção). */
export function visibleLotteries(
  map: AvailabilityMap,
  lotteries: readonly LotteryConfig[] = activeLotteries,
): LotteryConfig[] {
  return lotteries.filter((lottery) => availabilityOf(map, lottery.slug) !== "DISABLED");
}

/** Escolhe a modalidade inicial: a pedida, se estiver habilitada; senão a primeira habilitada. */
export function pickInitialLottery(
  requested: LotterySlug | undefined,
  enabled: readonly LotteryConfig[],
): LotterySlug | undefined {
  if (requested && enabled.some((lottery) => lottery.slug === requested)) return requested;
  return enabled[0]?.slug;
}
