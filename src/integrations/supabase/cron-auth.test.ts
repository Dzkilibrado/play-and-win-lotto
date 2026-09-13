import { afterEach, describe, expect, it, vi } from "vitest";

import { authenticateCronRequest } from "./cron-auth";

afterEach(() => vi.unstubAllEnvs());

describe("proteção da rota agendada", () => {
  it("recusa uma chamada sem credencial", async () => {
    vi.stubEnv("LOVABLE_CRON_SECRET", "segredo-atual");
    const response = await authenticateCronRequest(new Request("https://example.test"));
    expect(response?.status).toBe(401);
  });

  it("aceita a credencial atual e a anterior durante rotação", async () => {
    vi.stubEnv("LOVABLE_CRON_SECRET", "segredo-atual");
    vi.stubEnv("LOVABLE_CRON_SECRET_PREVIOUS", "segredo-anterior");
    const current = await authenticateCronRequest(
      new Request("https://example.test", { headers: { authorization: "Bearer segredo-atual" } }),
    );
    const previous = await authenticateCronRequest(
      new Request("https://example.test", { headers: { authorization: "Bearer segredo-anterior" } }),
    );
    expect(current).toBeNull();
    expect(previous).toBeNull();
  });

  it("recusa formato inválido e credencial incorreta", async () => {
    vi.stubEnv("LOVABLE_CRON_SECRET", "segredo-atual");
    const malformed = await authenticateCronRequest(
      new Request("https://example.test", { headers: { authorization: "segredo-atual" } }),
    );
    const wrong = await authenticateCronRequest(
      new Request("https://example.test", { headers: { authorization: "Bearer incorreto" } }),
    );
    expect(malformed?.status).toBe(401);
    expect(wrong?.status).toBe(401);
  });
});