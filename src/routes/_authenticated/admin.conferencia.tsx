import { createFileRoute, redirect } from "@tanstack/react-router";

import { CheckPanel } from "@/components/admin/AdminPanels";
import { useSession } from "@/hooks/useAuth";
import { AdminSection } from "@/components/admin/AdminSection";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/admin/conferencia")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({
    meta: [
      { title: `Conferência de jogos — ${appConfig.name}` },
      {
        name: "description",
        content: "Fila de conferência por concurso, reprocessamento e erros.",
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
      title="Conferência de jogos"
      description="Fila de conferência por concurso, reprocessamento e erros."
    >
      <CheckPanel userId={user.id} />
    </AdminSection>
  );
}
