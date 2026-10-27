import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { AdminSection } from "@/components/admin/AdminSection";
import { MaintenancePanel } from "@/components/admin/MaintenancePanel";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/admin/recursos")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({
    meta: [
      { title: `Controle do sistema — ${appConfig.name}` },
      { name: "description", content: "Modo manutenção e disponibilidade geral do sistema." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminSection
      title="Controle do sistema"
      description="Ações para situações de urgência, valendo para todos os usuários."
    >
      <MaintenancePanel />
      <Link
        to="/admin/loterias"
        className="surface-card tappable flex min-h-16 items-center gap-3 p-4 hover:border-primary"
      >
        <span className="min-w-0">
          <span className="block font-display text-sm font-semibold text-text-primary">
            Disponibilidade por loteria
          </span>
          <span className="block text-xs text-text-secondary">
            Habilitar, pausar ou desabilitar uma loteria específica.
          </span>
        </span>
        <ChevronRight className="ml-auto size-5 shrink-0 text-text-secondary" aria-hidden />
      </Link>
    </AdminSection>
  );
}
