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
    ordinal: index + 1,
    name: `Participante ${index + 1}`,
    quotas: (index % 3) + 1,
    paymentStatus: "PAID" as const,
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

  it.each([23, 50, 100, 200])("mostra a prévia e permite ver todos com %i pessoas", (total) => {
    render(<PublicParticipantList participants={people(total)} />);
    expect(screen.getAllByText(/^Participante \d+$/)).toHaveLength(
      publicPreviewSize.participants,
    );
    fireEvent.click(screen.getByRole("button", { name: `Ver todos os ${total} participantes` }));
    expect(screen.getAllByText(/^Participante \d+$/)).toHaveLength(total);
  });

  it("usa singular correto e o selo Pago", () => {
    render(<PublicParticipantList participants={[{ ordinal: 1, name: "Gilber", quotas: 1, paymentStatus: "PAID" }]} />);
    expect(screen.getByText("1 cota")).toBeTruthy();
    expect(screen.getByText("✓ Pago")).toBeTruthy();
  });

  it("mantém nomes longos em uma coluna truncável sem perder cotas e status", () => {
    const name = "Participante com um nome excepcionalmente longo para validar a coluna";
    render(<PublicParticipantList participants={[{ ordinal: 1, name, quotas: 2, paymentStatus: "PAID" }]} />);
    const cell = screen.getByTitle(name);
    expect(cell.className).toContain("truncate");
    expect(screen.getByText("2 cotas")).toBeTruthy();
    expect(screen.getByText("✓ Pago")).toBeTruthy();
  });

  it("busca por nome, sem diferenciar acentos", () => {
    render(<PublicParticipantList participants={[...people(20), { ordinal: 21, name: "Íris", quotas: 2, paymentStatus: "PAID" }]} />);
    fireEvent.change(screen.getByLabelText("Buscar participante"), { target: { value: "iris" } });
    expect(screen.getByText("Íris")).toBeTruthy();
    expect(screen.queryByText("Participante 1")).toBeNull();
  });
});

describe("lista pública de jogos", () => {
  afterEach(cleanup);

  it.each([19, 50, 100])("mostra a prévia e permite ver todos com %i jogos", (total) => {
    render(<PublicGameList games={games(total)} drawnNumbers={[]} linkedGames={total} confirmedBets={total} />);
    expect(screen.getAllByText(/^Jogo \d+$/)).toHaveLength(publicPreviewSize.games);
    fireEvent.click(screen.getByRole("button", { name: /Ver todos/ }));
    expect(screen.getAllByText(/^Jogo \d+$/)).toHaveLength(total);
  });

  it("mostra um jogo sem expansão", () => {
    render(<PublicGameList games={games(1)} drawnNumbers={[]} linkedGames={1} confirmedBets={1} />);
    expect(screen.getAllByText(/^Jogo \d+$/)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Ver todos/ })).toBeNull();
  });

  it("mostra jogos planejados com aviso transparente", () => {
    const planned = games(19).map((game) => ({ ...game, status: "PLANNED" as const }));
    render(<PublicGameList games={planned} drawnNumbers={[]} linkedGames={19} confirmedBets={0} />);
    expect(screen.getByText(/ainda não representam aposta confirmada/i)).toBeTruthy();
    expect(screen.getAllByText("Planejado")).toHaveLength(publicPreviewSize.games);
  });
});
