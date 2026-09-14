import { describe, expect, it } from "vitest";
import { resolveQueryState } from "./queryState";

describe("resolveQueryState", () => {
  it("não transforma carregamento inicial em sucesso vazio", () => {
    expect(resolveQueryState({ data: undefined, isPending: true, isFetching: true, isError: false })).toBe("loading");
    expect(resolveQueryState({ data: undefined, isPending: false, isFetching: true, isError: false })).toBe("loading");
  });

  it("distingue erro de zero confirmado", () => {
    expect(resolveQueryState({ data: undefined, isPending: false, isFetching: false, isError: true })).toBe("error");
    expect(resolveQueryState({ data: [], isPending: false, isFetching: false, isError: false })).toBe("success");
  });

  it("preserva dados anteriores durante atualização em segundo plano", () => {
    expect(resolveQueryState({ data: [1], isPending: false, isFetching: true, isError: false })).toBe("success");
  });
});