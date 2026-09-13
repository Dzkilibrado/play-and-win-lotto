import { describe, expect, it } from "vitest";

import {
  expectedDrawAt,
  consistencyCheckAt,
  isBeforeExpectedDraw,
  nextPreDrawAction,
  nextRetryAt,
  publicationNeedsAttention,
  retryDelayMinutes,
  waitingStatus,
} from "./automation";
import { recoveryContestRange } from "./lotterySync.server";

describe("automação de concursos", () => {
  it("interpreta o horário previsto em America/Sao_Paulo", () => {
    expect(expectedDrawAt("2026-09-14")).toBe("2026-09-14T21:00:00-03:00");
    expect(expectedDrawAt("2026-09-13")).toBe("2026-09-13T11:00:00-03:00");
  });

  it("não consulta a fonte antes do sorteio", () => {
    expect(
      isBeforeExpectedDraw(
        new Date("2026-09-13T13:59:59.000Z"),
        "2026-09-13T11:00:00-03:00",
      ),
    ).toBe(true);
    expect(
      isBeforeExpectedDraw(
        new Date("2026-09-13T14:00:00.000Z"),
        "2026-09-13T11:00:00-03:00",
      ),
    ).toBe(false);
  });

  it("usa janela rápida e depois backoff de 30, 60 e 120 minutos", () => {
    expect(
      retryDelayMinutes(0, new Date("2026-09-14T00:30:00.000Z"), "2026-09-14T00:00:00.000Z"),
    ).toBe(10);
    expect([0, 1, 2, 8].map((value) => retryDelayMinutes(value))).toEqual([30, 60, 120, 120]);
    expect(nextRetryAt(new Date("2026-09-14T00:00:00.000Z"), 1)).toBe(
      "2026-09-14T01:00:00.000Z",
    );
  });

  it("agenda saúde, pré-sorteio e o próprio sorteio sem polling contínuo", () => {
    expect(nextPreDrawAction(new Date("2026-09-14T11:00:00.000Z"), "2026-09-15T00:00:00.000Z"))
      .toEqual({ action: "HEALTH_CHECK", at: "2026-09-14T15:00:00.000Z" });
    expect(nextPreDrawAction(new Date("2026-09-14T23:30:00.000Z"), "2026-09-15T00:00:00.000Z"))
      .toEqual({ action: "WAIT_PUBLICATION", at: "2026-09-15T00:00:00.000Z" });
  });

  it("agenda revisão posterior e alerta somente após atraso relevante", () => {
    expect(consistencyCheckAt(new Date("2026-09-14T00:00:00.000Z"))).toBe(
      "2026-09-14T06:00:00.000Z",
    );
    expect(publicationNeedsAttention(new Date("2026-09-14T12:00:00.000Z"), "2026-09-14T00:00:00.000Z")).toBe(true);
    expect(publicationNeedsAttention(new Date("2026-09-14T11:59:59.000Z"), "2026-09-14T00:00:00.000Z")).toBe(false);
  });

  it("mantém indisponibilidade em espera e destaca resposta inválida", () => {
    expect(waitingStatus("UNAVAILABLE", 2)).toBe("WAITING_PUBLICATION");
    expect(waitingStatus("VALIDATION", 1)).toBe("ATTENTION");
    expect(waitingStatus("UNAVAILABLE", 8)).toBe("ATTENTION");
  });

  it("recupera lacunas em ordem e nunca pula o primeiro concurso ausente", () => {
    expect(recoveryContestRange(3050, 3056)).toEqual({ start: 3051, end: 3055 });
    expect(recoveryContestRange(3055, 3056)).toEqual({ start: 3056, end: 3056 });
    expect(recoveryContestRange(3056, 3056)).toBeNull();
  });
});