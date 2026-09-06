import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchOfficialDraw, SyncError } from "./caixa.provider.server";

const basePayload = {
  numero: 2500,
  dataApuracao: "10/08/2022",
  listaDezenas: ["01", "02", "03", "04", "05", "06"],
  acumulado: false,
  valorArrecadado: 1000,
  ultimoConcurso: false,
};

function mockResponse(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parser de faixas de premiação", () => {
  it("rejeita explicitamente uma descrição de faixa não interpretável", async () => {
    mockResponse({
      ...basePayload,
      listaRateioPremio: [
        { faixa: 1, descricaoFaixa: "6 acertos", numeroDeGanhadores: 0, valorPremio: 0 },
        { faixa: 2, descricaoFaixa: "Faixa especial", numeroDeGanhadores: 3, valorPremio: 10 },
      ],
    });

    await expect(fetchOfficialDraw("mega-sena", 2500)).rejects.toMatchObject({
      name: "SyncError",
      type: "VALIDATION",
    });
  });

  it("nunca descarta faixa em silêncio: todas as faixas retornadas são normalizadas", async () => {
    mockResponse({
      ...basePayload,
      listaRateioPremio: [
        { faixa: 1, descricaoFaixa: "6 acertos", numeroDeGanhadores: 0, valorPremio: 0 },
        { faixa: 2, descricaoFaixa: "5 acertos", numeroDeGanhadores: 50, valorPremio: 30000 },
        { faixa: 3, descricaoFaixa: "4 acertos", valorPremio: 700 },
      ],
    });

    const draw = await fetchOfficialDraw("mega-sena", 2500);
    expect(draw.prizes).toHaveLength(3);
    // 0 informado oficialmente permanece 0.
    expect(draw.prizes[0]).toMatchObject({ hits: 6, winners: 0, prizePerWinner: 0 });
    // Campo ausente vira null, nunca 0.
    expect(draw.prizes[2]).toMatchObject({ hits: 4, winners: null, prizePerWinner: 700 });
  });

  it("rejeita faixas duplicadas", async () => {
    mockResponse({
      ...basePayload,
      listaRateioPremio: [
        { faixa: 1, descricaoFaixa: "6 acertos", numeroDeGanhadores: 1, valorPremio: 1 },
        { faixa: 2, descricaoFaixa: "6 acertos", numeroDeGanhadores: 2, valorPremio: 2 },
      ],
    });
    await expect(fetchOfficialDraw("mega-sena", 2500)).rejects.toBeInstanceOf(SyncError);
  });

  it("rejeita quantidade de dezenas fora da regra da modalidade", async () => {
    mockResponse({ ...basePayload, listaDezenas: ["01", "02", "03"], listaRateioPremio: [] });
    await expect(fetchOfficialDraw("mega-sena", 2500)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });
});
