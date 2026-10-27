import * as Astronomy from "astronomy-engine";
import { describe, expect, it } from "vitest";

import {
  ascendantLongitude,
  moonPhaseIndex,
  signFromLongitude,
  sunLongitude,
  zodiac,
} from "./astrology";
import { localToUtc, searchMunicipalities, type Municipality } from "./birthTime";

describe("astrologia", () => {
  it("tem 12 signos completos", () => {
    expect(zodiac).toHaveLength(12);
    expect(new Set(zodiac.map((sign) => sign.index)).size).toBe(12);
  });
  it("signo solar na virada do equinócio de 2000 (20/03 07:35 UT)", () => {
    expect(signFromLongitude(sunLongitude(new Date("2000-03-19T12:00:00Z"))).name).toBe("Peixes");
    expect(signFromLongitude(sunLongitude(new Date("2000-03-21T12:00:00Z"))).name).toBe("Áries");
    expect(signFromLongitude(sunLongitude(new Date("1990-07-15T15:00:00Z"))).name).toBe("Câncer");
  });
  it("fases da Lua: nova em 06/01/2000 e cheia em 21/01/2000", () => {
    expect(moonPhaseIndex(new Date("2000-01-06T18:14:00Z"))).toBe(0);
    expect(moonPhaseIndex(new Date("2000-01-21T04:40:00Z"))).toBe(4);
  });
  it("ascendente no nascer do Sol coincide com a longitude do Sol", () => {
    for (const [lat, lon] of [
      [-23.55, -46.63],
      [-3.12, -60.02],
      [-30.03, -51.23],
    ] as const) {
      const rise = Astronomy.SearchRiseSet(
        Astronomy.Body.Sun,
        new Astronomy.Observer(lat, lon, 0),
        +1,
        new Date("2024-03-10T00:00:00Z"),
        1,
      )!;
      const asc = ascendantLongitude(rise.date, lat, lon);
      const sun = sunLongitude(rise.date);
      const diff = Math.abs(((asc - sun + 540) % 360) - 180);
      expect(diff).toBeLessThan(3);
    }
  });
});

describe("hora de nascimento", () => {
  it("considera o horário de verão histórico de São Paulo", () => {
    expect(localToUtc("1990-01-15", "12:00", "America/Sao_Paulo").toISOString()).toBe(
      "1990-01-15T14:00:00.000Z",
    );
    expect(localToUtc("1990-07-15", "12:00", "America/Sao_Paulo").toISOString()).toBe(
      "1990-07-15T15:00:00.000Z",
    );
  });
  it("respeita fusos diferentes", () => {
    expect(localToUtc("2000-06-01", "12:00", "America/Rio_Branco").toISOString()).toBe(
      "2000-06-01T17:00:00.000Z",
    );
  });
  it("busca de município ignora acento e prioriza início do nome", () => {
    const list: Municipality[] = [
      {
        name: "São Paulo",
        uf: "SP",
        latitude: -23.55,
        longitude: -46.63,
        timeZone: "America/Sao_Paulo",
      },
      {
        name: "Santa Paula",
        uf: "GO",
        latitude: -18,
        longitude: -50,
        timeZone: "America/Sao_Paulo",
      },
      {
        name: "Vila de São Paulo",
        uf: "XX",
        latitude: 0,
        longitude: 0,
        timeZone: "America/Sao_Paulo",
      },
    ];
    const result = searchMunicipalities(list, "sao paul");
    expect(result[0]?.name).toBe("São Paulo");
    expect(result.map((item) => item.name)).toContain("Vila de São Paulo");
    expect(searchMunicipalities(list, "s")).toEqual([]);
  });
});
