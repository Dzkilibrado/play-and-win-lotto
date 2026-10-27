import { describe, expect, it } from "vitest";

import { accessModules } from "@/config/accessModules";

import { canAct, countGranted, normalizeMatrix, sameMatrix, setPermission } from "./permissions";

describe("matriz de permissões", () => {
  it("cria uma linha por módulo, na ordem do catálogo", () => {
    const matrix = normalizeMatrix([]);
    expect(matrix.map((row) => row.module)).toEqual(accessModules.map((m) => m.key));
    expect(countGranted(matrix)).toBe(0);
  });

  it("ignora módulos desconhecidos e entrada inválida", () => {
    expect(normalizeMatrix(null)).toHaveLength(accessModules.length);
    expect(normalizeMatrix([{ module: "xx", view: true }])).toHaveLength(accessModules.length);
    expect(countGranted(normalizeMatrix([{ module: "xx", view: true }]))).toBe(0);
  });

  it("criar, editar ou excluir exigem ver", () => {
    const matrix = normalizeMatrix([{ module: "usuarios", edit: true }]);
    expect(canAct(matrix, "usuarios", "view")).toBe(true);
    expect(canAct(matrix, "usuarios", "edit")).toBe(true);
  });

  it("ligar uma ação liga ver; desligar ver desliga tudo do módulo", () => {
    let matrix = setPermission(normalizeMatrix([]), "atendimento", "create", true);
    expect(canAct(matrix, "atendimento", "view")).toBe(true);
    matrix = setPermission(matrix, "atendimento", "edit", true);
    matrix = setPermission(matrix, "atendimento", "view", false);
    expect(countGranted(matrix)).toBe(0);
  });

  it("não altera outros módulos e compara matrizes", () => {
    const base = normalizeMatrix([]);
    const changed = setPermission(base, "monitor", "view", true);
    expect(sameMatrix(base, changed)).toBe(false);
    expect(canAct(changed, "usuarios", "view")).toBe(false);
    expect(sameMatrix(changed, setPermission(changed, "monitor", "view", true))).toBe(true);
  });
});
