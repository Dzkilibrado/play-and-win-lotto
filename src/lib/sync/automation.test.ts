import { describe, expect, it } from "vitest";

import {
  expectedDrawAt,
  isBeforeExpectedDraw,
  nextRetryAt,
  retryDelayMinutes,
  waitingStatus,
} from "./automation";

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

  it("aplica backoff persistente de 15, 30, 60 e 120 minutos", () => {
    expect([0, 1, 2, 3, 8].map(retryDelayMinutes)).toEqual([15, 30, 60, 120, 120]);
    expect(nextRetryAt(new Date("2026-09-14T00:00:00.000Z"), 1)).toBe(
      "2026-09-14T00:30:00.000Z",
    );
  });

  it("mantém indisponibilidade em espera e destaca resposta inválida", () => {
    expect(waitingStatus("UNAVAILABLE", 2)).toBe("WAITING_PUBLICATION");
    expect(waitingStatus("VALIDATION", 1)).toBe("ATTENTION");
    expect(waitingStatus("UNAVAILABLE", 8)).toBe("ATTENTION");
  });
});