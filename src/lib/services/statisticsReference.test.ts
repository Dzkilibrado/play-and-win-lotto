/**
 * Regressão do "wiring" temporal: concurso escolhido → maxContest → RPC.
 * Protege contra vazamento de dados futuros em refatorações.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: { contest_number: 3053 }, error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

const { statisticsService } = await import("./statisticsService");
const { buildStatisticsQuery, resolveReferenceContest } = await import("./statisticsReference");

function payload(lastContest: number | null) {
  return {
    data: {
      contestsAnalyzed: 10,
      windowContests: 10,
      lastContestConsidered: lastContest,
      firstContestConsidered: 1,
      numbers: [{ number: 1, totalOccurrences: 3, recentOccurrences: 1, drawsSinceLastAppearance: 2 }],
    },
    error: null,
  };
}

async function runWithChoice(
  choice: "next" | "custom" | "none",
  nextContest: number | null,
  custom: string,
) {
  const contestNumber = resolveReferenceContest(choice, nextContest, custom);
  await statisticsService.getNumberStatistics(
    buildStatisticsQuery({ lotterySlug: "mega-sena", window: 50, contestNumber }),
  );
  return { contestNumber, rpcArgs: rpc.mock.calls.at(-1)![1] as Record<string, unknown> };
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue(payload(3052));
  statisticsService.invalidate();
});

describe("referência temporal da geração", () => {
  it("concurso escolhido N chega ao serviço como maxContest = N", async () => {
    const { contestNumber, rpcArgs } = await runWithChoice("custom", 3054, "2000");
    expect(contestNumber).toBe(2000);
    expect(rpcArgs["_max_contest"]).toBe(2000);
  });

  it("próximo concurso N usa maxContest = N (só concursos anteriores entram)", async () => {
    rpc.mockResolvedValue(payload(3053));
    const { contestNumber, rpcArgs } = await runWithChoice("next", 3054, "");
    expect(contestNumber).toBe(3054);
    expect(rpcArgs["_max_contest"]).toBe(3054);
    const snapshot = await statisticsService.getNumberStatistics(
      buildStatisticsQuery({ lotterySlug: "mega-sena", window: 50, contestNumber }),
    );
    expect(snapshot.lastContestConsidered!).toBeLessThan(3054);
  });

  it("concurso muito à frente usa apenas os sorteios já existentes", async () => {
    rpc.mockResolvedValue(payload(3053));
    const { rpcArgs } = await runWithChoice("custom", 3054, "999999");
    expect(rpcArgs["_max_contest"]).toBe(999999);
    const snapshot = await statisticsService.getNumberStatistics(
      buildStatisticsQuery({ lotterySlug: "mega-sena", window: 50, contestNumber: 999999 }),
    );
    expect(snapshot.lastContestConsidered).toBe(3053);
  });

  it("sem concurso escolhido a referência é o histórico completo", async () => {
    const { contestNumber, rpcArgs } = await runWithChoice("none", 3054, "2000");
    expect(contestNumber).toBeNull();
    expect(rpcArgs["_max_contest"]).toBeNull();
  });

  it("referência histórica fechada é reaproveitada sem nova consulta", async () => {
    const query = buildStatisticsQuery({
      lotterySlug: "mega-sena",
      window: 50,
      contestNumber: 2000,
    });
    await statisticsService.getNumberStatistics(query);
    await statisticsService.getNumberStatistics(query);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("a sincronização ainda invalida a referência histórica", async () => {
    const query = buildStatisticsQuery({
      lotterySlug: "mega-sena",
      window: 50,
      contestNumber: 2000,
    });
    await statisticsService.getNumberStatistics(query);
    statisticsService.invalidate("mega-sena");
    await statisticsService.getNumberStatistics(query);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
