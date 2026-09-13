import { describe, expect, it } from "vitest";
import { shouldAuthenticatePassword } from "./loginFlow";

describe("fluxo de login", () => {
  it("não autentica quando o navegador apenas preenche as credenciais", () => {
    expect(shouldAuthenticatePassword(false)).toBe(false);
  });

  it("autentica depois de clique ou Enter explícito", () => {
    expect(shouldAuthenticatePassword(true)).toBe(true);
  });
});
