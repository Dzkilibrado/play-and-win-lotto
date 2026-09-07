import { describe, expect, it } from "vitest";

import { prizeValueLabel } from "./prizeLabels";

describe("prizeValueLabel", () => {
  it("valor ausente continua sendo pendente, nunca zero", () => {
    const label = prizeValueLabel(null);
    expect(label.pending).toBe(true);
    expect(label.value).toBe("Valor oficial ainda não informado");
  });

  it("zero é exibido como zero, nunca como pendente", () => {
    const label = prizeValueLabel(0);
    expect(label.pending).toBe(false);
    expect(label.value).toContain("0,00");
    expect(label.note).toContain("valor oficial informado");
  });

  it("zero com ganhadores conhecidos iguais a zero explica a acumulação", () => {
    const label = prizeValueLabel(0, 0);
    expect(label.note).toContain("acumulou");
  });

  it("zero com ganhadores desconhecidos não afirma acumulação", () => {
    expect(prizeValueLabel(0, null).note).not.toContain("acumulou");
    expect(prizeValueLabel(0, undefined).note).not.toContain("acumulou");
  });

  it("valor positivo aparece em moeda e sem observação", () => {
    const label = prizeValueLabel(912.43);
    expect(label.note).toBeNull();
    expect(label.value).toContain("912,43");
  });
});
