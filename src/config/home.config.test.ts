import { describe, expect, it } from "vitest";
import { defaultHomeBlocks, getHomeBlockDefinition } from "./home.config";

describe("configuração padrão da Home", () => {
  it("mantém resultados disponíveis, mas desligados por padrão", () => {
    expect(getHomeBlockDefinition("recent_results")?.label).toBe("Últimos resultados");
    expect(defaultHomeBlocks.find((block) => block.key === "recent_results")?.enabled).toBe(false);
  });

  it("prioriza bolões antes dos widgets secundários", () => {
    expect(defaultHomeBlocks[0]?.key).toBe("pools");
  });
});
