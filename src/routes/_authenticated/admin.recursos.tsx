import { createFileRoute, redirect } from "@tanstack/react-router";

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
    </AdminSection>
  );
}
