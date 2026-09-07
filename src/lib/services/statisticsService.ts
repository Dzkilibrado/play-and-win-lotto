/**
 * Fonte única dos indicadores históricos por dezena.
 *
 * O cálculo acontece no PostgreSQL (função agregadora `lottery_number_statistics`)
 * e o cliente recebe apenas um registro por dezena — 60 na Mega-Sena, 25 na
 * Lotofácil, 80 na Quina. Nenhum concurso completo trafega para o navegador.
 *
 * Esta é a MESMA fonte que a futura página de Estatísticas vai consumir: não
 * existe cálculo exclusivo dos Pesos Inteligentes.
 */
import { supabase } from "@/integrations/supabase/client";
import { weightsConfig } from "@/config/weights.config";
import type { StatisticsSnapshot } from "@/lib/engine/weights";

export interface StatisticsQuery {
  lotterySlug: string;
  /** Janela recente em concursos; null = todo o histórico. */
  window: number | null;
  /**
   * Referência temporal: só entram concursos ANTERIORES a este número.
   * null = todos os concursos já sorteados.
   */
  maxContest: number | null;
}

interface CacheEntry {
  snapshot: StatisticsSnapshot;
  storedAt: number;
  /** Último concurso conhecido da modalidade quando o cache foi criado. */
  latestContest: number | null;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(query: StatisticsQuery) {
  return `${query.lotterySlug}|${query.window ?? "all"}|${query.maxContest ?? "latest"}`;
}

function parseSnapshot(raw: unknown, query: StatisticsQuery): StatisticsSnapshot {
  const data = (raw ?? {}) as Record<string, unknown>;
  const numbers = Array.isArray(data["numbers"]) ? (data["numbers"] as Record<string, unknown>[]) : [];
  const int = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
  return {
    lotterySlug: query.lotterySlug,
    contestsAnalyzed: int(data["contestsAnalyzed"]),
    windowContests: int(data["windowContests"]),
    requestedWindow: query.window,
    lastContestConsidered:
      typeof data["lastContestConsidered"] === "number" ? data["lastContestConsidered"] : null,
    firstContestConsidered:
      typeof data["firstContestConsidered"] === "number" ? data["firstContestConsidered"] : null,
    numbers: numbers.map((row) => ({
      number: int(row["number"]),
      totalOccurrences: int(row["totalOccurrences"]),
      recentOccurrences: int(row["recentOccurrences"]),
      drawsSinceLastAppearance: int(row["drawsSinceLastAppearance"]),
    })),
  };
}

export const statisticsService = {
  /** Último concurso oficial registrado — usado para invalidar o cache. */
  async getLatestContestNumber(lotterySlug: string): Promise<number | null> {
    const { data, error } = await supabase
      .from("lottery_draws")
      .select("contest_number, lotteries!inner(slug)")
      .eq("lotteries.slug", lotterySlug)
      .order("contest_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.contest_number ?? null;
  },

  /**
   * Indicadores por dezena.
   *
   * Cache: as estatísticas só mudam quando um concurso novo daquela modalidade
   * entra no banco. A chave inclui modalidade, janela e referência temporal, e
   * a entrada é descartada quando o último concurso conhecido muda ou quando o
   * tempo de validade expira.
   */
  async getNumberStatistics(query: StatisticsQuery): Promise<StatisticsSnapshot> {
    const key = cacheKey(query);
    const cached = cache.get(key);

    /**
     * Referência histórica fechada: os concursos anteriores a `maxContest` não
     * mudam com a entrada de um concurso novo, então nem consultamos o último
     * concurso. Correções da fonte oficial continuam cobertas porque a
     * sincronização chama `invalidate()`.
     */
    if (
      query.maxContest != null &&
      cached &&
      Date.now() - cached.storedAt < weightsConfig.historicalStatisticsCacheTtlMs
    ) {
      return cached.snapshot;
    }

    const latestContest =
      query.maxContest != null ? null : await this.getLatestContestNumber(query.lotterySlug);
    const fresh =
      cached &&
      query.maxContest == null &&
      cached.latestContest === latestContest &&
      Date.now() - cached.storedAt < weightsConfig.statisticsCacheTtlMs;
    if (cached && fresh) return cached.snapshot;

    const { data, error } = await supabase.rpc("lottery_number_statistics" as never, {
      _lottery_slug: query.lotterySlug,
      _window: query.window,
      _max_contest: query.maxContest,
    } as never);
    if (error) throw error;

    const snapshot = parseSnapshot(data, query);
    cache.set(key, { snapshot, storedAt: Date.now(), latestContest });

    return snapshot;
  },

  /** Invalida o cache (usado após sincronizar concursos novos). */
  invalidate(lotterySlug?: string) {
    if (!lotterySlug) {
      cache.clear();
      return;
    }
    for (const key of [...cache.keys()]) {
      if (key.startsWith(`${lotterySlug}|`)) cache.delete(key);
    }
  },
};
