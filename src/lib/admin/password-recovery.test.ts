import { describe, expect, it, vi } from "vitest";
import { performAdminRecovery } from "./password-recovery";

function dependencies(allowed = true, providers = ["email"]) {
  return { authorize: vi.fn(async () => allowed), target: vi.fn(async () => ({ email: "test@example.com", identities: providers.map((provider) => ({ provider })) })), audit: vi.fn(async () => {}), send: vi.fn(async () => {}) };
}
describe("disparo administrativo de recuperação", () => {
  it("nega USER antes de consultar alvo ou enviar", async () => {
    const deps = dependencies(false);
    await expect(performAdminRecovery("target", deps)).rejects.toThrow("Acesso restrito");
    expect(deps.target).not.toHaveBeenCalled(); expect(deps.send).not.toHaveBeenCalled();
  });
  it("ADMIN envia sem retornar e-mail ou credenciais", async () => {
    const deps = dependencies();
    expect(await performAdminRecovery("target", deps)).toEqual({ ok: true });
    expect(deps.send).toHaveBeenCalledWith("test@example.com");
    expect(deps.audit).toHaveBeenCalledWith("target");
  });
  it("nega Google-only no servidor", async () => {
    const deps = dependencies(true, ["google"]);
    await expect(performAdminRecovery("target", deps)).rejects.toThrow("método local");
    expect(deps.send).not.toHaveBeenCalled();
  });
  it("falha de auditoria impede envio", async () => {
    const deps = dependencies(); deps.audit.mockRejectedValue(new Error("audit unavailable"));
    await expect(performAdminRecovery("target", deps)).rejects.toThrow("audit unavailable");
    expect(deps.send).not.toHaveBeenCalled();
  });
  it("propaga falha de envio sem anunciar sucesso", async () => {
    const deps = dependencies(); deps.send.mockRejectedValue(new Error("limit"));
    await expect(performAdminRecovery("target", deps)).rejects.toThrow("limit");
  });
});