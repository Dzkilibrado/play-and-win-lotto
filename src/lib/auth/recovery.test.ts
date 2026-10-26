import { describe, expect, it } from "vitest";
import { hasLocalPassword, isRecoveryClaims, recoveryPasswordSchema, requestRecovery, RECOVERY_REDIRECT, recoveryError, RECOVERY_WAIT_MESSAGE } from "./recovery";

describe("recuperação oficial", () => {
  it("fixa o domínio oficial sem receber redirect do cliente", () => {
    expect(RECOVERY_REDIRECT).toBe("https://www.gestordasorte.com.br/reset-password");
  });
  it("responde igualmente a e-mail existente e inexistente", async () => {
    expect(await requestRecovery(async () => ({ error: null }))).toEqual(await requestRecovery(async () => ({ error: { code: "user_not_found" } })));
  });
  it("não anuncia aceitação em falha de rede", async () => {
    expect((await requestRecovery(async () => { throw new Error("offline"); })).accepted).toBe(false);
  });
  it("respeita limite nativo de envio", () => {
    expect(recoveryError({ status: 429 })).toBe(RECOVERY_WAIT_MESSAGE);
  });
  it("não usa sessão de senha comum como recuperação", () => {
    expect(isRecoveryClaims({ exp: 2000, amr: [{ method: "password" }] }, 1_000_000)).toBe(false);
  });
  it("rejeita sessão expirada", () => {
    expect(isRecoveryClaims({ exp: 500, amr: [{ method: "recovery" }] }, 1_000_000)).toBe(false);
  });
  it("aceita sessão oficial de recuperação ou OTP", () => {
    expect(isRecoveryClaims({ exp: 2000, amr: [{ method: "recovery" }] }, 1_000_000)).toBe(true);
    expect(isRecoveryClaims({ exp: 2000, amr: [{ method: "otp" }] }, 1_000_000)).toBe(true);
  });
  it("impede senhas diferentes", () => {
    expect(recoveryPasswordSchema.safeParse({ password: "abc123456", confirmation: "different" }).success).toBe(false);
  });
  it("não oferece redefinição local para Google-only", () => {
    expect(hasLocalPassword(["google"])).toBe(false);
  });
  it("aceita método local em conta híbrida", () => {
    expect(hasLocalPassword(["google", "email"])).toBe(true);
  });
});