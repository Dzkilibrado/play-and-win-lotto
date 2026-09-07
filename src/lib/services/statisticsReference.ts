/**
 * Referência temporal única entre a tela de geração e a camada estatística.
 *
 * Existe para que o "concurso escolhido" e o `maxContest` enviado ao banco
 * nunca se separem: a RPC só considera concursos ANTERIORES a `maxContest`,
 * então qualquer refatoração que perca essa ligação reintroduziria vazamento
 * temporal. Está isolado aqui para poder ser testado.
 */
import type { StatisticsQuery } from "./statisticsService";

export type ContestChoice = "next" | "custom" | "none";

/** Concurso de referência do jogo, conforme a escolha na tela. */
export function resolveReferenceContest(
  choice: ContestChoice,
  nextContest: number | null,
  customContest: string | number | null,
): number | null {
  if (choice === "none") return null;
  if (choice === "next") return nextContest ?? null;
  const parsed = typeof customContest === "number" ? customContest : Number(customContest);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

/** Consulta estatística correspondente a essa referência. */
export function buildStatisticsQuery(input: {
  lotterySlug: string;
  window: number | null;
  contestNumber: number | null;
}): StatisticsQuery {
  return {
    lotterySlug: input.lotterySlug,
    window: input.window,
    // Sem reinterpretação: o concurso do jogo vira o teto temporal.
    maxContest: input.contestNumber,
  };
}
