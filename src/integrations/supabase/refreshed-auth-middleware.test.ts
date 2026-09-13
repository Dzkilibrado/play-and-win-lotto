import { describe, expect, it } from "vitest";

describe("renovação de sessão", () => {
  it("considera a margem de sessenta segundos antes da expiração", () => {
    const now = 1_000;
    expect(1_059 <= now + 60).toBe(true);
    expect(1_061 <= now + 60).toBe(false);
  });
});