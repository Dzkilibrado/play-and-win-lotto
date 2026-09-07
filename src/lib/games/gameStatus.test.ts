import { describe, expect, it } from "vitest";

import { statusForReceipt, statusWarning, gameDisplayName, originLabel } from "./gameStatus";

describe("statusForReceipt", () => {
  it("concurso já sorteado vira aguardando conferência", () => {
    expect(statusForReceipt("drawn")).toBe("AWAITING_CHECK");
  });

  it("concurso ainda não sorteado vira aguardando sorteio", () => {
    expect(statusForReceipt("pending")).toBe("AWAITING_DRAW");
  });

  it("concurso desconhecido na base fica apenas comprovado", () => {
    expect(statusForReceipt("unknown")).toBe("RECEIPTED");
  });
});

describe("statusWarning", () => {
  it("alerta quando o jogo espera sorteio de concurso já sorteado", () => {
    expect(statusWarning("AWAITING_DRAW", "drawn")).toBeTruthy();
  });

  it("alerta quando o jogo espera conferência de concurso não sorteado", () => {
    expect(statusWarning("AWAITING_CHECK", "pending")).toBeTruthy();
  });

  it("não alerta em situação coerente", () => {
    expect(statusWarning("AWAITING_CHECK", "drawn")).toBeNull();
    expect(statusWarning("AWAITING_DRAW", "pending")).toBeNull();
  });
});

describe("apresentação", () => {
  it("nome amigável não usa identificador interno", () => {
    expect(gameDisplayName(7)).toBe("Jogo 07");
    expect(gameDisplayName(null)).toBe("Jogo");
  });

  it("origem de comprovante é descrita em português", () => {
    expect(originLabel("PHOTO_RECEIPT")).toBe("Importado de comprovante");
  });
});
