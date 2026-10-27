/**
 * Regras puras do "próximo sorteio" mostrado ao usuário e da frequência de
 * atualização do calendário. Sem rede e sem React.
 */
export interface NextDrawSnapshot {
  contestNumber: number | null;
  drawDate: string | null; // AAAA-MM-DD
  estimatedPrize: number | null;
  fetchedAt: string | null;
}

export type NextDrawView =
  | { kind: "ready"; contestNumber: number; drawDate: string | null; estimatedPrize: number | null }
  | { kind: "awaiting"; contestNumber: number | null; drawDate: string | null }
  | { kind: "unavailable" };

const DAY = 24 * 60 * 60 * 1000;

/** Fim do dia do sorteio em São Paulo (UTC-3). */
function endOfDrawDay(drawDate: string): number {
  return Date.parse(`${drawDate}T23:59:59-03:00`);
}

/**
 * Decide o que exibir. Dado vencido (data já passou e ninguém atualizou)
 * nunca aparece como se fosse o próximo: vira "aguardando o canal oficial".
 */
export function resolveNextDrawView(snapshot: NextDrawSnapshot | null, now: Date): NextDrawView {
  if (!snapshot || snapshot.contestNumber == null) return { kind: "unavailable" };
  if (snapshot.drawDate && endOfDrawDay(snapshot.drawDate) < now.getTime()) {
    return { kind: "awaiting", contestNumber: snapshot.contestNumber, drawDate: snapshot.drawDate };
  }
  return {
    kind: "ready",
    contestNumber: snapshot.contestNumber,
    drawDate: snapshot.drawDate,
    estimatedPrize: snapshot.estimatedPrize,
  };
}

export interface RefreshState {
  drawDate: string | null;
  fetchedAt: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
}

/** Intervalos (min): normal, depois do sorteio e em falha — sempre mais curtos quando algo está errado. */
export const nextDrawRefresh = {
  normalMinutes: 360,
  afterDrawMinutes: 10,
  failureMinutes: [5, 10, 15, 30] as const,
};

/** Há consulta a fazer agora? */
export function shouldRefreshNextDraw(state: RefreshState | null, now: Date): boolean {
  if (!state || !state.fetchedAt || !state.lastAttemptAt) return true;
  const sinceAttempt = (now.getTime() - Date.parse(state.lastAttemptAt)) / 60_000;
  if (state.consecutiveFailures > 0) {
    const steps = nextDrawRefresh.failureMinutes;
    const wait = steps[Math.min(state.consecutiveFailures - 1, steps.length - 1)] ?? 30;
    return sinceAttempt >= wait;
  }
  if (state.drawDate) {
    const drawStart = Date.parse(`${state.drawDate}T21:00:00-03:00`);
    const overdueMinutes = (now.getTime() - drawStart) / 60_000;
    // Sorteio passou e o calendário ainda aponta para ele: ciclos curtos na
    // primeira janela e, depois, de hora em hora (nunca martela a fonte).
    if (overdueMinutes >= 0) {
      return sinceAttempt >= (overdueMinutes <= 12 * 60 ? nextDrawRefresh.afterDrawMinutes : 60);
    }
  }
  return sinceAttempt >= nextDrawRefresh.normalMinutes;
}
