import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  currentPasswordError,
  getAccountMethods,
  passwordChangeError,
} from "./password-security";

function userWithProviders(...providers: string[]) {
  return {
    identities: providers.map((provider) => ({ provider })),
  } as User;
}

describe("segurança da senha", () => {
  it("aceita senha válida e confirmação igual", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "atual123", newPassword: "nova1234", confirmation: "nova1234" }).success).toBe(true);
  });

  it("rejeita campos obrigatórios vazios", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "", newPassword: "", confirmation: "" }).success).toBe(false);
  });

  it("rejeita nova senha fora da política", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "atual123", newPassword: "curta", confirmation: "curta" }).success).toBe(false);
  });

  it("rejeita confirmação divergente com mensagem específica", () => {
    const result = changePasswordSchema.safeParse({ currentPassword: "atual123", newPassword: "nova1234", confirmation: "diferente" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("As novas senhas não coincidem.");
  });

  it("identifica conta exclusiva de e-mail e senha", () => {
    expect(getAccountMethods(userWithProviders("email"))).toEqual({ hasPassword: true, hasGoogle: false, labels: ["E-mail e senha"] });
  });

  it("identifica conta exclusiva Google sem criar senha local", () => {
    expect(getAccountMethods(userWithProviders("google"))).toEqual({ hasPassword: false, hasGoogle: true, labels: ["Google"] });
  });

  it("identifica conta com múltiplos métodos vinculados", () => {
    expect(getAccountMethods(userWithProviders("google", "email"))).toEqual({ hasPassword: true, hasGoogle: true, labels: ["E-mail e senha", "Google"] });
  });

  it("não infere senha pela existência de e-mail", () => {
    expect(getAccountMethods({ email: "pessoa@example.com", identities: [] } as unknown as User).hasPassword).toBe(false);
  });

  it("traduz falhas sem expor detalhes técnicos", () => {
    expect(currentPasswordError({ code: "invalid_credentials", status: 400 })).toBe("A senha atual informada está incorreta.");
    expect(passwordChangeError({ code: "same_password" })).toBe("A nova senha deve ser diferente da senha atual.");
    expect(currentPasswordError({ code: "over_request_rate_limit", status: 429 })).toContain("Muitas tentativas");
  });
});