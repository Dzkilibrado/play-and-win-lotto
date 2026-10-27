import { createFileRoute, redirect } from "@tanstack/react-router";

import { FeatureFlagsPanel } from "@/components/admin/AdminPanels";
import { useSession } from "@/hooks/useAuth";
import { AdminSection } from "@/components/admin/AdminSection";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/admin/recursos")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({
    meta: [
      { title: `Recursos do sistema — ${appConfig.name}` },
      {
        name: "description",
        content: "Chaves que ligam ou desligam funções para todos os usuários.",
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
      title="Recursos do sistema"
      description="Chaves que ligam ou desligam funções para todos os usuários."
    >
      <FeatureFlagsPanel userId={user.id} />
    </AdminSection>
  );
}
