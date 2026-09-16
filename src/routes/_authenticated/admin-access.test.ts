import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminRoute = readFileSync("src/routes/_authenticated/admin.tsx", "utf8");
const authenticatedLayout = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
const moreRoute = readFileSync("src/routes/_authenticated/more.tsx", "utf8");
const syncFunctions = readFileSync("src/lib/sync.functions.ts", "utf8");
const checkFunctions = readFileSync("src/lib/check.functions.ts", "utf8");

describe("segregação ADMIN e USER", () => {
  it("resolve ADMIN pela identidade autenticada e pela tabela de roles", () => {
    expect(authenticatedLayout).toContain('.from("user_roles")');
    expect(authenticatedLayout).toContain('.eq("user_id", data.user.id)');
    expect(authenticatedLayout).toContain('row.role === "ADMIN"');
  });

  it("nega a rota antes de montar a página administrativa", () => {
    expect(adminRoute).toMatch(/beforeLoad: \(\{ context \}\) => \{\s*if \(!context\.isAdmin\)/);
    expect(adminRoute).toContain('redirect({ to: "/dashboard", replace: true })');
    expect(adminRoute).not.toContain("useIsAdmin");
  });

  it("não inclui Administração na tela Mais para USER", () => {
    expect(moreRoute).toContain("...(isAdmin ? adminNav : [])");
  });

  it("revalida ADMIN no servidor antes de sincronização e conferência", () => {
    for (const source of [syncFunctions, checkFunctions]) {
      expect(source).toContain(".middleware([requireSupabaseAuth])");
      expect(source).toContain('rpc("has_role"');
      expect(source).toContain("await assertAdmin(context as never)");
    }
  });
});