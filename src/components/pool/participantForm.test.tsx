// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { validatePaymentMethod } from "@/components/pool/PaymentMethodField";
import { describePaymentMethod, paymentMethods } from "@/config/pools.config";

describe("formas de pagamento", () => {
  it("aceita somente os quatro valores canônicos", () => {
    expect([...paymentMethods].sort()).toEqual(["CARD", "CASH", "OTHER", "PIX"]);
  });

  it("exige descrição quando a forma é Outro", () => {
    expect(validatePaymentMethod("OTHER", "   ")).toBeTruthy();
    expect(validatePaymentMethod("OTHER", "Transferência")).toBeNull();
  });

  it("não exige descrição nas demais formas", () => {
    expect(validatePaymentMethod("PIX", "")).toBeNull();
    expect(validatePaymentMethod("CASH", "")).toBeNull();
    expect(validatePaymentMethod("CARD", "")).toBeNull();
  });

  it("descreve a forma com o texto complementar quando existir", () => {
    expect(describePaymentMethod("PIX")).toBe("Pix");
    expect(describePaymentMethod("OTHER", "Boleto")).toContain("Boleto");
  });
});
