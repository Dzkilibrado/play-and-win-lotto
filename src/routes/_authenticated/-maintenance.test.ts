import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/routes/_authenticated/route.tsx", "utf8");
const panel = readFileSync("src/components/admin/MaintenancePanel.tsx", "utf8");
const migrationName = readdirSync("supabase/migrations").find((name) =>
  name.startsWith("20261027250000"),
)!;
const migration = readFileSync(`supabase/migrations/${migrationName}`, "utf8");

describe("modo manutenção geral", () => {
  it("bloqueia a interface para quem não é administrador", () => {
    expect(layout).toContain("status.maintenance && !isAdmin");
    expect(layout).toContain("<MaintenanceScreen");
  });

  it("só administrador liga ou desliga, com auditoria", () => {
    expect(migration).toContain("has_role(auth.uid(), 'ADMIN')");
    expect(migration).toContain("SYSTEM_MAINTENANCE_CHANGED");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.admin_set_maintenance(boolean, text) FROM PUBLIC, anon",
    );
  });

  it("a trava vale no banco para jogos e bolões, preservando administrador e serviço", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.guard_lottery_available()");
    expect(migration).toContain("auth.uid() IS NOT NULL");
    expect(migration).toContain("NOT public.has_role(auth.uid(), 'ADMIN')");
  });

  it("a tabela não é legível diretamente e o painel pede confirmação para ligar", () => {
    expect(migration).toContain(
      "REVOKE ALL ON public.system_maintenance FROM PUBLIC, anon, authenticated",
    );
    expect(panel).toContain("AlertDialog");
    expect(panel).toContain("Mensagem para os usuários");
  });
});
