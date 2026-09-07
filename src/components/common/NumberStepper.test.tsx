// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { NumberStepper } from "./NumberStepper";

function Harness({ min, max, start }: { min: number; max: number; start: number }) {
  const [value, setValue] = useState(start);
  return (
    <NumberStepper id="t" label="dezenas por jogo" value={value} onChange={setValue} min={min} max={max} />
  );
}

describe("NumberStepper", () => {
  afterEach(cleanup);

  it("incrementa e decrementa de 1 em 1", () => {
    render(<Harness min={6} max={20} start={6} />);
    const input = screen.getByLabelText("dezenas por jogo") as HTMLInputElement;
    fireEvent.click(screen.getByLabelText("Aumentar dezenas por jogo"));
    expect(input.value).toBe("7");
    fireEvent.click(screen.getByLabelText("Diminuir dezenas por jogo"));
    expect(input.value).toBe("6");
  });

  it("bloqueia os botões nos limites da modalidade", () => {
    render(<Harness min={5} max={15} start={5} />);
    expect((screen.getByLabelText("Diminuir dezenas por jogo") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("dezenas por jogo"), { target: { value: "15" } });
    fireEvent.blur(screen.getByLabelText("dezenas por jogo"));
    expect((screen.getByLabelText("Aumentar dezenas por jogo") as HTMLButtonElement).disabled).toBe(true);
  });

  it("aceita digitação direta dentro do intervalo", () => {
    render(<Harness min={6} max={20} start={6} />);
    const input = screen.getByLabelText("dezenas por jogo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.blur(input);
    expect(input.value).toBe("12");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("recusa valores fora do intervalo com mensagem curta", () => {
    render(<Harness min={6} max={20} start={6} />);
    const input = screen.getByLabelText("dezenas por jogo") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toBe("Escolha um valor entre 6 e 20.");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toBe("Escolha um valor entre 6 e 20.");
  });
});
