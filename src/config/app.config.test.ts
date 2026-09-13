import { describe, expect, it } from "vitest";

import { appConfig, publicAppUrl } from "./app.config";

describe("endereço público oficial", () => {
  it("centraliza o domínio canônico com WWW", () => {
    expect(appConfig.domain).toBe("www.gestordasorte.com.br");
    expect(appConfig.canonicalOrigin).toBe("https://www.gestordasorte.com.br");
  });

  it("preserva rota, token e parâmetros", () => {
    expect(publicAppUrl("/b/TOKEN?origem=homologacao")).toBe("https://www.gestordasorte.com.br/b/TOKEN?origem=homologacao");
  });
});