import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminRoute = readFileSync("src/routes/_authenticated/admin.index.tsx", "utf8");
// As telas internas da Administração (cada função em sua rota) e os painéis
// compartilhados também precisam respeitar a mesma segregação.
const adminPanels = readFileSync("src/components/admin/AdminPanels.tsx", "utf8");
const adminSubRoutes = ["atualizacao", "conferencia", "loterias", "recursos", "acessos"].map(
  (name) => readFileSync(`src/routes/_authenticated/admin.${name}.tsx`, "utf8"),
);
const authenticatedLayout = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
const moreRoute = readFileSync("src/routes/_authenticated/more.tsx", "utf8");
const syncFunctions = readFileSync("src/lib/sync.functions.ts", "utf8");
const checkFunctions = readFileSync("src/lib/check.functions.ts", "utf8");
const featureFlagsHook = readFileSync("src/hooks/useFeatureFlags.tsx", "utf8");
const usersRoute = readFileSync("src/routes/_authenticated/admin.users.tsx", "utf8");
const lotteriesFunctions = readFileSync("src/lib/admin/lotteries.functions.ts", "utf8");
const usersFunctions = readFileSync("src/lib/admin/users.functions.ts", "utf8");
const activeAuthMiddleware = readFileSync("src/lib/auth/active-auth-middleware.ts", "utf8");
const loginRoute = readFileSync("src/routes/login.tsx", "utf8");

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
    for (const source of adminSubRoutes) {
      expect(source).toMatch(/beforeLoad: \(\{ context \}\) => \{\s*if \(!context\.isAdmin\)/);
      expect(source).toContain('redirect({ to: "/dashboard", replace: true })');
    }
  });

  it("não inclui Administração na tela Mais para USER", () => {
    expect(moreRoute).toContain("...(isAdmin ? adminNav : [])");
  });

  it("revalida ADMIN no servidor antes de sincronização e conferência", () => {
    for (const source of [syncFunctions, checkFunctions]) {
      expect(source).toContain(".middleware([requireActiveSupabaseAuth])");
      expect(source).toContain('rpc("has_role"');
      expect(source).toContain("await assertAdmin(context as never)");
    }
  });

  it("isola todos os caches administrativos pela identidade", () => {
    expect(adminPanels).toContain('["admin", userId, "sync-overview"]');
    expect(adminPanels).toContain('["admin", userId, "check-overview"]');
    expect(featureFlagsHook).toContain('["admin", userId, "feature-flags"]');
    expect(usersRoute).toContain("privateQueryKeys.adminUsers(user.id");
  });

  it("protege rota e consulta de usuários sem expor campos pessoais", () => {
    expect(usersRoute).toMatch(/beforeLoad: \(\{ context \}\) => \{\s*if \(!context\.isAdmin\)/);
    expect(usersFunctions).toContain(".middleware([requireActiveSupabaseAuth])");
    expect(usersFunctions).toContain('rpc("has_role"');
    expect(usersFunctions).toContain('rpc("admin_list_users_v2"');
    for (const forbidden of ["phone", "birth_date", "access_token", "refresh_token"]) {
      expect(usersFunctions).not.toContain(forbidden);
    }
  });

  it("revalida a conta no servidor para encerrar sessões bloqueadas", () => {
    expect(activeAuthMiddleware).toContain(".middleware([requireSupabaseAuth])");
    expect(activeAuthMiddleware).toContain("context.supabase.auth.getUser()");
    expect(activeAuthMiddleware).toContain("ACCOUNT_BLOCKED");
    expect(loginRoute).toContain("BLOCKED_LOGIN_MESSAGE");
  });

  it("protege bloqueio por papel, identidade, responsável e continuidade administrativa", () => {
    expect(usersFunctions).toContain('rpc("has_role"');
    expect(usersFunctions).toContain("data.targetUserId === context.userId");
    expect(usersFunctions).toContain("system_owner_user_id");
    expect(usersFunctions).toContain('rpc("admin_active_count")');
    expect(usersFunctions).toContain(
      'action: data.action === "BLOCK" ? "USER_BLOCKED" : "USER_UNBLOCKED"',
    );
  });

  it("só ADMIN altera a disponibilidade das modalidades, e a gravação é auditada no banco", () => {
    expect(lotteriesFunctions).toContain(".middleware([requireActiveSupabaseAuth])");
    expect(lotteriesFunctions).toContain('rpc("has_role"');
    expect(lotteriesFunctions).toContain("await assertAdmin(context as never)");
    expect(lotteriesFunctions).toContain('"admin_set_lottery_availability"');
    expect(adminSubRoutes.join("\n")).toContain("<LotteryAvailabilityPanel />");
  });
});

describe("tipos de acesso e troca de perfil", () => {
  const accessFunctions = readFileSync("src/lib/admin/access.functions.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20261027280000_f1a6c9d2-3b47-48e5-a0d9-7c2e5b1f8a64.sql",
    "utf8",
  );

  it("revalida ADMIN no servidor antes de ler ou gravar permissões e perfis", () => {
    expect(accessFunctions.match(/\.middleware\(\[requireActiveSupabaseAuth\]\)/g)).toHaveLength(3);
    expect(accessFunctions.match(/await requireAdmin\(context\)/g)).toHaveLength(3);
  });

  it("a troca de perfil protege o último administrador, o responsável principal e a própria conta", () => {
    expect(migration).toContain(
      "O último administrador ativo não pode perder o acesso de administrador.",
    );
    expect(migration).toContain("O responsável principal não pode ter o tipo de acesso alterado.");
    expect(migration).toContain("Você não pode alterar o seu próprio tipo de acesso.");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("as funções de escrita só são executáveis pelo service_role", () => {
    for (const fn of [
      "admin_set_user_role",
      "admin_set_role_permissions",
      "admin_get_role_permissions",
    ]) {
      expect(migration).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role;`),
      );
    }
  });

  it("a tela de usuários usa nomes em português para os tipos de acesso", () => {
    expect(usersRoute).toContain("accessRoleLabel");
    expect(usersRoute).not.toContain('<option value="USER">USER</option>');
  });
});
