// @vitest-environment jsdom
/**
 * Garante que componentes conceitualmente clicáveis respondam em toda a sua
 * área visual — texto, centro, laterais, contador e seta — e não apenas no
 * ícone. Complementa a revisão manual feita nos cartões e listas.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActiveFilterChip } from "@/components/common/Filters";
import { GameCard } from "@/components/lottery/GameCard";
import type { GameAnalysisResult } from "@/lib/engine/types";

afterEach(cleanup);

const analysis = {
  evenCount: 3,
  oddCount: 3,
  sumTotal: 150,
  primeCount: 2,
  fibonacciCount: 1,
  repeatedFromLast: 1,
  maxSequence: 2,
  maxGap: 12,
  rowDistribution: { "1": 2, "2": 4 },
  columnDistribution: { "1": 3, "2": 3 },
  comparedToContest: 3053,
} as unknown as GameAnalysisResult;

describe("área clicável do acordeão do GameCard", () => {
  const cases: Array<[string, () => HTMLElement]> = [
    ["no texto", () => screen.getByText("Ver análise completa")],
    ["na linha inteira", () => screen.getByRole("button", { name: /análise/i })],
    ["na seta", () => screen.getByRole("button", { name: /análise/i }).querySelector("svg")!.parentElement!],
  ];

  for (const [name, target] of cases) {
    it(`expande ao tocar ${name}`, () => {
      render(<GameCard title="Jogo 1" numbers={[1, 2, 3, 4, 5, 6]} analysis={analysis} />);
      const row = screen.getByRole("button", { name: /análise/i });
      expect(row.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(target());
      expect(screen.getByRole("button", { name: /análise/i }).getAttribute("aria-expanded")).toBe(
        "true",
      );
    });
  }

  it("a linha do acordeão ocupa toda a largura e tem altura de toque confortável", () => {
    render(<GameCard title="Jogo 1" numbers={[1, 2, 3, 4, 5, 6]} analysis={analysis} />);
    const row = screen.getByRole("button", { name: /análise/i });
    expect(row.className).toContain("w-full");
    expect(row.className).toContain("min-h-11");
  });
});

describe("chip de filtro ativo", () => {
  it("remove o filtro ao tocar no texto, não só no x", () => {
    const onRemove = vi.fn();
    render(<ActiveFilterChip label="Situação: Aberto" onRemove={onRemove} />);
    fireEvent.click(screen.getByText(/Situação: Aberto/));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("é um botão único cobrindo toda a superfície", () => {
    render(<ActiveFilterChip label="Loteria: Quina" onRemove={() => {}} />);
    const chip = screen.getByRole("button", { name: /Remover filtro/ });
    expect(chip.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("cartões de navegação são clicáveis por inteiro", () => {
  const files = {
    PoolCard: "src/components/pool/PoolCard.tsx",
    ContestCard: "src/components/lottery/ContestCard.tsx",
    StatCard: "src/components/common/Cards.tsx",
  };

  for (const [name, path] of Object.entries(files)) {
    it(`${name} usa um Link como elemento externo`, () => {
      const source = readFileSync(path, "utf8");
      // Nenhuma seta pode ficar fora do elemento navegável.
      const linkIndex = source.indexOf("<Link");
      expect(linkIndex).toBeGreaterThanOrEqual(0);
      // A seta nunca é o alvo do clique: ou está dentro do Link, ou vem de um
      // bloco de conteúdo renderizado dentro dele.
      const chevronIndex = source.indexOf("<ChevronRight");
      if (chevronIndex >= 0 && chevronIndex < linkIndex) {
        expect(source.slice(linkIndex)).toContain("{content}");
      }
      expect(source).not.toContain("onClick={(event) => event.stopPropagation()}");
    });
  }
});
