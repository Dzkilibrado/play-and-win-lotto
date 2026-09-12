import { describe, expect, it } from "vitest";
import { formatBrazilianPhone, isAdult, normalizeBrazilianPhone, signupSchema } from "./identity";

describe("identidade de acesso", () => {
  it("formata e normaliza celular brasileiro", () => {
    expect(formatBrazilianPhone("27992020234")).toBe("(27) 99202-0234");
    expect(normalizeBrazilianPhone("(27) 99202-0234")).toBe("+5527992020234");
  });
  it("rejeita telefone incompleto", () => expect(normalizeBrazilianPhone("2799")).toBeNull());
  it("calcula maioridade pela data completa", () => {
    const reference = new Date("2026-09-12T12:00:00Z");
    expect(isAdult("2008-09-12", reference)).toBe(true);
    expect(isAdult("2008-09-13", reference)).toBe(false);
  });
  it("exige confirmação e aceite no cadastro", () => {
    const result = signupSchema.safeParse({ name: "Pessoa Teste", birthDate: "2000-01-01", phone: "27992020234", email: "pessoa@example.com", password: "segura123", confirmPassword: "outra123", accepted: false });
    expect(result.success).toBe(false);
  });
});
