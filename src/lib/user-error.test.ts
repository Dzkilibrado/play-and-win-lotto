import { describe, expect, it } from "vitest";

import { userErrorMessage } from "./user-error";

describe("mensagens seguras para usuários", () => {
  it.each([
    [{ message: "JWT expired", details: "storage path pools/private", hint: "check RLS" }],
    [{ message: "relation public.pool_documents does not exist" }],
    [{ message: "exp claim timestamp check failed" }],
  ])("oculta detalhes técnicos %#", (error) => {
    expect(userErrorMessage(error)).toBe("Não foi possível concluir esta ação. Tente novamente.");
  });

  it("preserva orientação funcional", () => {
    expect(userErrorMessage(new Error("O pagamento está acima do devido."))).toBe("O pagamento está acima do devido.");
  });
});