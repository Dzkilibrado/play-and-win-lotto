import { describe, expect, it } from "vitest";

import { backTargetFor } from "./backTarget";

describe("destino do botão Voltar", () => {
  it("telas principais não têm Voltar", () => {
    for (const path of ["/dashboard", "/generate", "/games", "/pools", "/more"]) {
      expect(backTargetFor(path)).toBeNull();
    }
  });

  it("áreas de Mais voltam para Mais", () => {
    for (const path of [
      "/settings",
      "/profile",
      "/statistics",
      "/notifications",
      "/lotteries",
      "/admin",
    ]) {
      expect(backTargetFor(path)?.to).toBe("/more");
    }
  });

  it("subtelas da Administração voltam para a Administração", () => {
    expect(backTargetFor("/admin/users")).toEqual({ to: "/admin", label: "Administração" });
    expect(backTargetFor("/admin/loterias/")).toEqual({ to: "/admin", label: "Administração" });
  });

  it("detalhes voltam para a lista de origem", () => {
    expect(backTargetFor("/games/abc")?.to).toBe("/games");
    expect(backTargetFor("/games/importar")?.to).toBe("/games");
    expect(backTargetFor("/pools/new")?.to).toBe("/pools");
    expect(backTargetFor("/pools/list")?.to).toBe("/pools");
    expect(backTargetFor("/contests/123")?.to).toBe("/contests");
    expect(backTargetFor("/pools/abc")).toBeNull();
  });

  it("rotas desconhecidas não mostram Voltar", () => {
    expect(backTargetFor("/qualquer")).toBeNull();
  });
});
