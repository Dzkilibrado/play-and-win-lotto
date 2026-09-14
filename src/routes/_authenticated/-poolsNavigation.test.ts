import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("refinamento estrutural de bolões e geração", () => {
  it("mantém o resumo de geração no fluxo normal e usa rótulo dinâmico", () => {
    const source = read("./generate.tsx");
    expect(source).not.toContain("sticky bottom-20");
    expect(source).not.toContain("pb-28");
    expect(source).toContain('gamesCount === 1 ? "Criar 1 jogo"');
  });

  it("faz os cards do hub abrirem a listagem, nunca o detalhe", () => {
    const source = read("./pools.index.tsx");
    expect(source).toContain('to="/pools/list"');
    expect(source).not.toContain('to="/pools/$id"');
    for (const label of ["Todos", "Em andamento", "Aguardando sorteio", "Com resultado", "Finalizados", "Arquivados"]) {
      expect(source).toContain(`label: "${label}"`);
    }
  });

  it("expõe Organização e preserva o contexto da listagem", () => {
    const detail = read("./pools.$id.tsx");
    const card = read("../../components/pool/PoolCard.tsx");
    expect(detail).toContain('{ value: "organization", label: "Organização" }');
    expect(detail).toContain('to="/pools/list" search={listSearch}');
    expect(card).toContain("search={listSearch ?? {}}");
  });

  it("mantém Organização textual e todas as ações de ciclo de vida fora do menu de três pontos", () => {
    const navigation = read("../../components/pool/PoolSectionNav.tsx");
    const organization = read("../../components/pool/PoolOrganizationPanel.tsx");
    const actions = read("../../components/pool/PoolActions.tsx");

    expect(navigation).toContain('aria-label="Áreas do bolão"');
    expect(navigation).toContain("grid-cols-2");
    expect(organization).toContain("Arquivar bolão");
    expect(organization).toContain("Restaurar bolão");
    expect(organization).toContain("Zona de risco");
    expect(organization).toContain("Excluir definitivamente");
    expect(organization).toContain("<ConfirmDialog");
    expect(actions).not.toContain("MoreHorizontal");
    expect(actions).not.toContain("Excluir definitivamente");
    expect(actions).not.toContain("Arquivar bolão");
    expect(actions).not.toContain("Restaurar bolão");
  });
});