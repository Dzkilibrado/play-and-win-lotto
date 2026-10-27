import { describe, expect, it } from "vitest";

import { resolveNextDrawView, shouldRefreshNextDraw } from "./nextDraw";

const now = new Date("2026-10-27T15:00:00-03:00");

describe("resolveNextDrawView", () => {
  it("sem dado = indisponível", () => {
    expect(resolveNextDrawView(null, now).kind).toBe("unavailable");
    expect(
      resolveNextDrawView({ contestNumber: null, drawDate: null, estimatedPrize: null, fetchedAt: null }, now).kind,
    ).toBe("unavailable");
  });
  it("data futura ou de hoje = pronto", () => {
    const view = resolveNextDrawView(
      { contestNumber: 10, drawDate: "2026-10-27", estimatedPrize: 5, fetchedAt: null },
      now,
    );
    expect(view.kind).toBe("ready");
  });
  it("data vencida nunca aparece como próximo (caso Timemania 2008)", () => {
    const view = resolveNextDrawView(
      { contestNumber: 6, drawDate: "2008-04-05", estimatedPrize: 2_800_000, fetchedAt: null },
      now,
    );
    expect(view.kind).toBe("awaiting");
  });
});

describe("shouldRefreshNextDraw", () => {
  const base = { drawDate: "2026-10-30", fetchedAt: "2026-10-27T14:00:00-03:00", lastAttemptAt: "2026-10-27T14:00:00-03:00", consecutiveFailures: 0 };
  it("nunca consultado = consulta", () => {
    expect(shouldRefreshNextDraw(null, now)).toBe(true);
  });
  it("em dia: espera o intervalo normal", () => {
    expect(shouldRefreshNextDraw(base, now)).toBe(false);
    expect(shouldRefreshNextDraw({ ...base, lastAttemptAt: "2026-10-27T08:00:00-03:00" }, now)).toBe(true);
  });
  it("falha: intervalo curto e crescente", () => {
    const failed = { ...base, consecutiveFailures: 1, lastAttemptAt: "2026-10-27T14:57:00-03:00" };
    expect(shouldRefreshNextDraw(failed, now)).toBe(false);
    expect(shouldRefreshNextDraw({ ...failed, lastAttemptAt: "2026-10-27T14:50:00-03:00" }, now)).toBe(true);
  });
  it("depois do sorteio: ciclos de 10 min", () => {
    const after = { ...base, drawDate: "2026-10-27", lastAttemptAt: "2026-10-27T14:45:00-03:00" };
    const late = new Date("2026-10-27T21:30:00-03:00");
    expect(shouldRefreshNextDraw({ ...after, lastAttemptAt: "2026-10-27T21:25:00-03:00" }, late)).toBe(false);
    expect(shouldRefreshNextDraw({ ...after, lastAttemptAt: "2026-10-27T21:15:00-03:00" }, late)).toBe(true);
  });
});
