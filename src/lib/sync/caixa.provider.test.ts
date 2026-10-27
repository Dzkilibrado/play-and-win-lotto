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

  it("interpreta 'nenhum acerto' como a faixa de 0 acertos", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, "0")),
      listaRateioPremio: [
        { faixa: 1, descricaoFaixa: "20 acertos", numeroDeGanhadores: 0, valorPremio: 500000 },
        { faixa: 2, descricaoFaixa: "Nenhum acerto", numeroDeGanhadores: 12, valorPremio: 5000 },
      ],
    });

    const draw = await fetchOfficialDraw("lotomania", 2500);
    const zeroTier = draw.prizes.find((prize) => prize.hits === 0);
    expect(zeroTier).toMatchObject({ hits: 0, winners: 12, prizePerWinner: 5000 });
  });

  it("interpreta '0 acertos' (variação com dígito) como a faixa de 0 acertos", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, "0")),
      listaRateioPremio: [
        { faixa: 1, descricaoFaixa: "0 acertos", numeroDeGanhadores: 7, valorPremio: 5000 },
      ],
    });

    const draw = await fetchOfficialDraw("lotomania", 2500);
    expect(draw.prizes[0]).toMatchObject({ hits: 0, winners: 7, prizePerWinner: 5000 });
  });
});

describe("validação por drawnCount (Lotomania: sorteio de 20, aposta de 50)", () => {
  it("aceita exatamente 20 dezenas sorteadas, mesmo com aposta simples de 50", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, "0")),
      listaRateioPremio: [
        { faixa: 1, descricaoFaixa: "20 acertos", numeroDeGanhadores: 1, valorPremio: 1 },
      ],
    });

    const draw = await fetchOfficialDraw("lotomania", 2500);
    expect(draw.numbers).toHaveLength(20);
  });

  it("rejeita quando a fonte não traz as 20 dezenas esperadas da Lotomania", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: Array.from({ length: 19 }, (_, index) => String(index + 1).padStart(2, "0")),
      listaRateioPremio: [],
    });
    await expect(fetchOfficialDraw("lotomania", 2500)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });

  it("continua exigindo 6 dezenas na Mega-Sena (drawnCount == selectable.base nas modalidades antigas)", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: Array.from({ length: 6 }, (_, index) => String(index + 1).padStart(2, "0")),
      listaRateioPremio: [],
    });
    const draw = await fetchOfficialDraw("mega-sena", 2500);
    expect(draw.numbers).toHaveLength(6);
  });
});

describe("Dupla Sena: 2 sorteios por concurso", () => {
  const first = ["03", "11", "20", "28", "35", "47"];
  const second = ["01", "09", "14", "26", "38", "50"];
  const rateio = [
    { faixa: 1, descricaoFaixa: "6 acertos", numeroDeGanhadores: 0, valorPremio: 0 },
    { faixa: 2, descricaoFaixa: "3 acertos", numeroDeGanhadores: 900, valorPremio: 12.5 },
    {
      faixa: 3,
      descricaoFaixa: "6 acertos - 2º Sorteio",
      numeroDeGanhadores: 1,
      valorPremio: 70000,
    },
    {
      faixa: 4,
      descricaoFaixa: "3 acertos - 2º Sorteio",
      numeroDeGanhadores: 800,
      valorPremio: 11,
    },
  ];

  it("separa as faixas e as dezenas dos dois sorteios (inclui o Terno)", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: first,
      listaDezenasSegundoSorteio: second,
      listaRateioPremio: rateio,
    });
    const draw = await fetchOfficialDraw("dupla-sena", 2500);
    expect(draw.numbers).toEqual([3, 11, 20, 28, 35, 47]);
    expect(draw.prizes.map((prize) => prize.hits)).toEqual([6, 3]);
    expect(draw.secondDraw?.numbers).toEqual([1, 9, 14, 26, 38, 50]);
    // O "2" de "2º Sorteio" nunca vira número de acertos.
    expect(draw.secondDraw?.prizes.map((prize) => prize.hits)).toEqual([6, 3]);
    expect(draw.secondDraw?.prizes[1]).toMatchObject({ winners: 800, prizePerWinner: 11 });
  });

  it("entende faixas descritas só pelo nome (Sena, Quina, Quadra, Terno)", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: first,
      listaDezenasSegundoSorteio: second,
      listaRateioPremio: [
        { faixa: 1, descricaoFaixa: "Sena", valorPremio: 1 },
        { faixa: 2, descricaoFaixa: "Terno", valorPremio: 2 },
        { faixa: 3, descricaoFaixa: "Quadra - 2º Sorteio", valorPremio: 3 },
      ],
    });
    const draw = await fetchOfficialDraw("dupla-sena", 2500);
    expect(draw.prizes.map((prize) => prize.hits)).toEqual([6, 3]);
    expect(draw.secondDraw?.prizes.map((prize) => prize.hits)).toEqual([4]);
  });

  it("recusa concurso sem o 2º sorteio", async () => {
    mockResponse({ ...basePayload, listaDezenas: first, listaRateioPremio: [] });
    await expect(fetchOfficialDraw("dupla-sena", 2500)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });

  it("recusa faixas dos dois sorteios sem marca de sorteio (duplicadas)", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: first,
      listaDezenasSegundoSorteio: second,
      listaRateioPremio: [
        { faixa: 1, descricaoFaixa: "6 acertos", valorPremio: 1 },
        { faixa: 2, descricaoFaixa: "6 acertos", valorPremio: 2 },
      ],
    });
    await expect(fetchOfficialDraw("dupla-sena", 2500)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });

  it("recusa 2º sorteio com quantidade errada de dezenas", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: first,
      listaDezenasSegundoSorteio: second.slice(0, 5),
      listaRateioPremio: [],
    });
    await expect(fetchOfficialDraw("dupla-sena", 2500)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });

  it("modalidades de sorteio único nunca trazem segundo sorteio", async () => {
    mockResponse({ ...basePayload, listaRateioPremio: [] });
    const draw = await fetchOfficialDraw("mega-sena", 2500);
    expect(draw.secondDraw).toBeNull();
  });
});

describe("Dia de Sorte: Mês da Sorte", () => {
  const numbers = ["02", "05", "11", "17", "23", "28", "31"];
  const rateio = [
    { faixa: 1, descricaoFaixa: "7 acertos", numeroDeGanhadores: 0, valorPremio: 0 },
    { faixa: 2, descricaoFaixa: "6 acertos", numeroDeGanhadores: 3, valorPremio: 1500 },
    { faixa: 3, descricaoFaixa: "5 acertos", numeroDeGanhadores: 90, valorPremio: 20 },
    { faixa: 4, descricaoFaixa: "4 acertos", numeroDeGanhadores: 1000, valorPremio: 5 },
    { faixa: 5, descricaoFaixa: "Mês de Sorte", numeroDeGanhadores: 800, valorPremio: 2.5 },
  ];

  it("lê o mês sorteado e a faixa própria, fora das faixas de dezenas", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: numbers,
      nomeTimeCoracaoMesSorte: "MARÇO",
      listaRateioPremio: rateio,
    });
    const draw = await fetchOfficialDraw("dia-de-sorte", 900);
    expect(draw.numbers).toHaveLength(7);
    expect(draw.prizes.map((prize) => prize.hits)).toEqual([7, 6, 5, 4]);
    expect(draw.secondary?.result).toEqual(["03"]);
    expect(draw.secondary?.prize).toMatchObject({ winners: 800, prizePerWinner: 2.5 });
  });

  it("aceita mês sem faixa informada (valor pendente, nunca zero)", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: numbers,
      nomeTimeCoracaoMesSorte: "Janeiro",
      listaRateioPremio: rateio.slice(0, 4),
    });
    const draw = await fetchOfficialDraw("dia-de-sorte", 900);
    expect(draw.secondary?.result).toEqual(["01"]);
    expect(draw.secondary?.prize).toBeNull();
  });

  it("recusa concurso sem o mês sorteado", async () => {
    mockResponse({ ...basePayload, listaDezenas: numbers, listaRateioPremio: rateio });
    await expect(fetchOfficialDraw("dia-de-sorte", 900)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });

  it("recusa mês não reconhecido", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: numbers,
      nomeTimeCoracaoMesSorte: "Marteiro",
      listaRateioPremio: rateio,
    });
    await expect(fetchOfficialDraw("dia-de-sorte", 900)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });

  it("recusa faixa do mês duplicada", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: numbers,
      nomeTimeCoracaoMesSorte: "MARÇO",
      listaRateioPremio: [...rateio, rateio[4]],
    });
    await expect(fetchOfficialDraw("dia-de-sorte", 900)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });
});

describe("Timemania: Time do Coração", () => {
  const numbers = ["07", "15", "22", "40", "51", "63", "78"];
  const rateio = [
    { faixa: 1, descricaoFaixa: "7 acertos", numeroDeGanhadores: 0, valorPremio: 0 },
    { faixa: 2, descricaoFaixa: "6 acertos", numeroDeGanhadores: 2, valorPremio: 60000 },
    { faixa: 3, descricaoFaixa: "5 acertos", numeroDeGanhadores: 70, valorPremio: 700 },
    { faixa: 4, descricaoFaixa: "4 acertos", numeroDeGanhadores: 900, valorPremio: 12 },
    { faixa: 5, descricaoFaixa: "3 acertos", numeroDeGanhadores: 9000, valorPremio: 3.5 },
    { faixa: 6, descricaoFaixa: "Time do Coração", numeroDeGanhadores: 40000, valorPremio: 1.5 },
  ];

  it("exige 7 dezenas sorteadas e normaliza o clube", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: numbers,
      nomeTimeCoracaoMesSorte: "Flamengo / RJ",
      listaRateioPremio: rateio,
    });
    const draw = await fetchOfficialDraw("timemania", 2100);
    expect(draw.numbers).toHaveLength(7);
    expect(draw.prizes.map((prize) => prize.hits)).toEqual([7, 6, 5, 4, 3]);
    expect(draw.secondary?.result).toEqual(["FLAMENGO/RJ"]);
    expect(draw.secondary?.prize).toMatchObject({ winners: 40000, prizePerWinner: 1.5 });
  });

  it("recusa as 10 dezenas da aposta no lugar das 7 sorteadas", async () => {
    mockResponse({
      ...basePayload,
      listaDezenas: [...numbers, "80", "81", "82"].slice(0, 10),
      nomeTimeCoracaoMesSorte: "FLAMENGO/RJ",
      listaRateioPremio: rateio,
    });
    await expect(fetchOfficialDraw("timemania", 2100)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });

  it("recusa concurso sem o Time do Coração", async () => {
    mockResponse({ ...basePayload, listaDezenas: numbers, listaRateioPremio: rateio });
    await expect(fetchOfficialDraw("timemania", 2100)).rejects.toMatchObject({
      type: "VALIDATION",
    });
  });
});

describe("modalidades sem seleção secundária", () => {
  it("nunca trazem resultado secundário", async () => {
    mockResponse({ ...basePayload, nomeTimeCoracaoMesSorte: "MARÇO", listaRateioPremio: [] });
    const draw = await fetchOfficialDraw("mega-sena", 2500);
    expect(draw.secondary).toBeNull();
  });
});
