import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const latest = { value: 3053 as number | null };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: latest.value === null ? null : { contest_number: latest.value },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

const { statisticsService } = await import("./statisticsService");

function payload(lastContest: number, contests: number) {
  return {
    data: {
      lotterySlug: "mega-sena",
      contestsAnalyzed: contests,
      windowContests: 20,
      lastContestConsidered: lastContest,
      firstContestConsidered: 1,
      numbers: [
        { number: 1, totalOccurrences: 10, recentOccurrences: 2, drawsSinceLastAppearance: 3 },
      ],
    },
    error: null,
  };
}

beforeEach(() => {
  rpc.mockReset();
  statisticsService.invalidate();
  latest.value = 3053;
});

describe("camada de estatísticas", () => {
  it("agrega no banco e traz um registro por dezena", async () => {
    rpc.mockResolvedValue(payload(3053, 3053));
    const snapshot = await statisticsService.getNumberStatistics({
      lotterySlug: "mega-sena",
      window: 20,
      maxContest: null,
    });
    expect(snapshot.numbers).toHaveLength(1);
    expect(snapshot.contestsAnalyzed).toBe(3053);
    expect(rpc).toHaveBeenCalledWith("lottery_number_statistics", {
      _lottery_slug: "mega-sena",
      _window: 20,
      _max_contest: null,
    });
  });

  it("nunca usa concursos posteriores ao concurso do jogo", async () => {
    rpc.mockResolvedValue(payload(3052, 3052));
    const snapshot = await statisticsService.getNumberStatistics({
      lotterySlug: "mega-sena",
      window: 50,
      maxContest: 3053,
    });
    expect(rpc.mock.calls[0]![1]).toMatchObject({ _max_contest: 3053 });
    expect(snapshot.lastContestConsidered).toBeLessThan(3053);
  });

  it("reaproveita o resultado em cache para a mesma consulta", async () => {
    rpc.mockResolvedValue(payload(3053, 3053));
    const query = { lotterySlug: "mega-sena", window: 20, maxContest: null };
    await statisticsService.getNumberStatistics(query);
    await statisticsService.getNumberStatistics(query);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("consulta de novo quando a janela ou a referência mudam", async () => {
    rpc.mockResolvedValue(payload(3053, 3053));
    await statisticsService.getNumberStatistics({
      lotterySlug: "mega-sena",
      window: 20,
      maxContest: null,
    });
    await statisticsService.getNumberStatistics({
      lotterySlug: "mega-sena",
      window: 50,
      maxContest: null,
    });
    await statisticsService.getNumberStatistics({
      lotterySlug: "mega-sena",
      window: 50,
      maxContest: 3000,
    });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("descarta o cache quando entra um concurso novo", async () => {
    rpc.mockResolvedValue(payload(3053, 3053));
    const query = { lotterySlug: "mega-sena", window: 20, maxContest: null };
    await statisticsService.getNumberStatistics(query);
    latest.value = 3054;
    await statisticsService.getNumberStatistics(query);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("invalida apenas a modalidade indicada", async () => {
    rpc.mockResolvedValue(payload(3053, 3053));
    await statisticsService.getNumberStatistics({
      lotterySlug: "mega-sena",
      window: 20,
      maxContest: null,
    });
    await statisticsService.getNumberStatistics({
      lotterySlug: "quina",
      window: 20,
      maxContest: null,
    });
    statisticsService.invalidate("quina");
    await statisticsService.getNumberStatistics({
      lotterySlug: "mega-sena",
      window: 20,
      maxContest: null,
    });
    await statisticsService.getNumberStatistics({
      lotterySlug: "quina",
      window: 20,
      maxContest: null,
    });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("propaga erro do banco em vez de devolver dados vazios", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("falha") });
    await expect(
      statisticsService.getNumberStatistics({
        lotterySlug: "mega-sena",
        window: null,
        maxContest: null,
      }),
    ).rejects.toThrow();
  });
});
