import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/layout/AppShell.tsx", "utf8");

describe("menu móvel compartilhado", () => {
  it("controla o painel em um único estado no cabeçalho", () => {
    expect(source).toContain("<Sheet open={menuOpen} onOpenChange={setMenuOpen}>");
  });

  it("fecha todos os destinos finais, inclusive a página atual", () => {
    expect(source).toContain("<SidebarNav onNavigate={closeMenu} />");
    expect(source).toContain("onClick={onNavigate}");
  });

  it("fecha também quando a rota muda por outra ação", () => {
    expect(source).toContain("const pathname = useRouterState");
    expect(source).toMatch(/useEffect\(\(\) => \{\s*setMenuOpen\(false\);\s*\}, \[pathname\]\)/);
  });

  it("relaciona o acionador ao painel para tecnologias assistivas", () => {
    expect(source).toContain('aria-controls="mobile-navigation"');
    expect(source).toContain('id="mobile-navigation"');
  });
});