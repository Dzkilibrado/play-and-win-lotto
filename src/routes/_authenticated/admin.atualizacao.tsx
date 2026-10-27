import { createFileRoute, redirect } from "@tanstack/react-router";

import { SyncPanel } from "@/components/admin/AdminPanels";
import { useSession } from "@/hooks/useAuth";
import { AdminSection } from "@/components/admin/AdminSection";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/admin/atualizacao")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({
    meta: [
      { title: `Atualização automática — ${appConfig.name}` },
      {
        name: "description",
        content: "Resultados e próximo sorteio vindos da fonte oficial, por loteria e para todas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user } = useSession();
  return (
    <AdminSection
      title="Atualização automática"
      description="Resultados e próximo sorteio vindos da fonte oficial, por loteria e para todas."
    >
      <SyncPanel userId={user.id} />
    </AdminSection>
  );
}
