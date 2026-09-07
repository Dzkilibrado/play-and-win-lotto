// @vitest-environment jsdom
/**
 * Comportamento das listas públicas com volumes grandes:
 * 50/100/200 participantes e 30/50/100 jogos.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PublicGameList } from "./PublicGameList";
import { PublicParticipantList } from "./PublicParticipantList";
import { publicPreviewSize, type PublicGame, type PublicParticipant } from "@/lib/pools/publicPool";

const people = (count: number): PublicParticipant[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `Participante ${index + 1}`,
    quotas: (index % 3) + 1,
  }));

const games = (count: number): PublicGame[] =>
  Array.from({ length: count }, (_, index) => ({
    ordinal: index + 1,
    numbers: [1, 2, 3, 4, 5, 6],
    status: "AWAITING_DRAW" as const,
    hits: null,
    isPrized: null,
    prizeLabel: null,
    prizeAmount: null,
  }));

describe("lista pública de participantes", () => {
  afterEach(cleanup);

  it.each([50, 100, 200])("mostra a prévia e permite ver todos com %i pessoas", (total) => {
    render(<PublicParticipantList participants={people(total)} />);
    expect(screen.getAllByText(/^Participante \d+$/)).toHaveLength(
      publicPreviewSize.participants,
    );
    fireEvent.click(screen.getByRole("button", { name: `Ver todos os ${total} participantes` }));
    expect(screen.getAllByText(/^Participante \d+$/)).toHaveLength(total);
  });

  it("usa COTA/COTAS em caixa alta e o selo PAGO", () => {
    render(<PublicParticipantList participants={[{ name: "Gilber", quotas: 1 }]} />);
    expect(screen.getByText("1 COTA")).toBeTruthy();
    expect(screen.getByText("Pago").className).toContain("uppercase");
  });

  it("busca por nome, sem diferenciar acentos", () => {
    render(<PublicParticipantList participants={[...people(20), { name: "Íris", quotas: 2 }]} />);
    fireEvent.change(screen.getByLabelText("Buscar participante"), { target: { value: "iris" } });
    expect(screen.getByText("Íris")).toBeTruthy();
    expect(screen.queryByText("Participante 1")).toBeNull();
  });
});

describe("lista pública de jogos", () => {
  afterEach(cleanup);

  it.each([30, 50, 100])("mostra a prévia e permite ver todos com %i jogos", (total) => {
    render(<PublicGameList games={games(total)} drawnNumbers={[]} />);
    expect(screen.getAllByText(/^Jogo \d+$/)).toHaveLength(publicPreviewSize.games);
    fireEvent.click(screen.getByRole("button", { name: /Ver todos/ }));
    expect(screen.getAllByText(/^Jogo \d+$/)).toHaveLength(total);
  });
});
