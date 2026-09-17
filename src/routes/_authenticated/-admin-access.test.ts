import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminRoute = readFileSync("src/routes/_authenticated/admin.tsx", "utf8");
const authenticatedLayout = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
const moreRoute = readFileSync("src/routes/_authenticated/more.tsx", "utf8");
const syncFunctions = readFileSync("src/lib/sync.functions.ts", "utf8");
const checkFunctions = readFileSync("src/lib/check.functions.ts", "utf8");
const featureFlagsHook = readFileSync("src/hooks/useFeatureFlags.tsx", "utf8");
const usersRoute = readFileSync("src/routes/_authenticated/admin.users.tsx", "utf8");
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
    expect(adminRoute).toContain('["admin", userId, "sync-overview"]');
    expect(adminRoute).toContain('["admin", userId, "check-overview"]');
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
    expect(usersFunctions).toContain('action: data.action === "BLOCK" ? "USER_BLOCKED" : "USER_UNBLOCKED"');
  });
});