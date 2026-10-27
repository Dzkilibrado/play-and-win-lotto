import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { activeLotteries } from "@/config/lotteries";
import {
  availabilityOf,
  buildAvailabilityMap,
  enabledLotteries,
  parseAvailability,
  pickInitialLottery,
  visibleLotteries,
} from "./lotteryAvailability";

const map = buildAvailabilityMap([
  { slug: "mega-sena", availability: "ENABLED", availability_note: null },
  { slug: "quina", availability: "MAINTENANCE", availability_note: "Ajuste de resultados" },
  { slug: "lotofacil", availability: "DISABLED", availability_note: null },
]);

describe("disponibilidade das modalidades", () => {
  it("valor desconhecido ou ausente conta como habilitada", () => {
    expect(parseAvailability(null)).toBe("ENABLED");
    expect(parseAvailability("qualquer")).toBe("ENABLED");
    expect(availabilityOf(map, "lotomania")).toBe("ENABLED");
  });

  it("criação só com habilitadas", () => {
    const slugs = enabledLotteries(map).map((lottery) => lottery.slug);
    expect(slugs).toContain("mega-sena");
    expect(slugs).not.toContain("quina");
    expect(slugs).not.toContain("lotofacil");
  });

  it("listas mostram habilitadas e em manutenção, nunca desabilitadas", () => {
    const slugs = visibleLotteries(map).map((lottery) => lottery.slug);
    expect(slugs).toContain("mega-sena");
    expect(slugs).toContain("quina");
    expect(slugs).not.toContain("lotofacil");
  });

  it("nunca expõe modalidade inativa na configuração", () => {
    const active = new Set(activeLotteries.map((lottery) => lottery.slug));
    for (const lottery of visibleLotteries(buildAvailabilityMap([]))) {
      expect(active.has(lottery.slug)).toBe(true);
    }
    expect(visibleLotteries(buildAvailabilityMap([])).map((l) => l.slug)).not.toContain(
      "mais-milionaria",
    );
  });

  it("modalidade inicial: a pedida se habilitada, senão a primeira habilitada", () => {
    const enabled = enabledLotteries(map);
    expect(pickInitialLottery("mega-sena", enabled)).toBe("mega-sena");
    expect(pickInitialLottery("quina", enabled)).toBe(enabled[0]?.slug);
    expect(pickInitialLottery(undefined, enabled)).toBe(enabled[0]?.slug);
    expect(pickInitialLottery("mega-sena", [])).toBeUndefined();
  });
});

describe("migração de disponibilidade", () => {
  const dir = "supabase/migrations";
  const file = readdirSync(dir).find((name) =>
    readFileSync(`${dir}/${name}`, "utf8").includes("admin_set_lottery_availability"),
  );
  const sql = file ? readFileSync(`${dir}/${file}`, "utf8") : "";

  it("trava jogo e bolão novos no banco e restringe a função ao ADMIN", () => {
    expect(file).toBeDefined();
    expect(sql).toContain("BEFORE INSERT ON public.generated_games");
    expect(sql).toContain("BEFORE INSERT ON public.pools");
    expect(sql).toContain("has_role(auth.uid(), 'ADMIN')");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.admin_set_lottery_availability(text, text, text) FROM PUBLIC, anon",
    );
    expect(sql).toContain("'LOTTERY_AVAILABILITY_CHANGED'");
  });

  it("Dupla Sena nasce desabilitada", () => {
    expect(sql).toMatch(/SET availability = 'DISABLED'[\s\S]*slug = 'dupla-sena'/);
  });
});
