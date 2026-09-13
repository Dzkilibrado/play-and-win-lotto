import { describe, expect, it } from "vitest";

import { canonicalRedirect } from "./canonical-url.server";

describe("redirecionamento para o domínio canônico", () => {
  it("preserva rota, token e parâmetros com redirecionamento permanente", () => {
    const response = canonicalRedirect(new Request("https://gestordasorte.com.br/b/TOKEN?origem=homologacao"));
    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://www.gestordasorte.com.br/b/TOKEN?origem=homologacao");
  });

  it.each([
    "https://www.gestordasorte.com.br/b/TOKEN",
    "https://gestordasorte.lovable.app/b/TOKEN",
    "http://localhost:8080/b/TOKEN",
  ])("não interfere em %s", (url) => {
    expect(canonicalRedirect(new Request(url))).toBeNull();
  });
});