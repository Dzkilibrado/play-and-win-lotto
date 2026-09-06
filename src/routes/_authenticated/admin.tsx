import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, LoadingState } from "@/components/common/StateViews";
import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { appConfig } from "@/config/app.config";
import { useIsAdmin, useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: `Administração — ${appConfig.name}` },
      { name: "description", content: "Área administrativa do aplicativo." },
      { property: "og:title", content: `Administração — ${appConfig.name}` },
      { property: "og:description", content: "Área administrativa do aplicativo." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useSession();
  const isAdmin = useIsAdmin(user);

  if (isAdmin.isLoading) return <LoadingState rows={2} />;

  if (!isAdmin.data) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Esta área é exclusiva para administradores. As regras de acesso também são aplicadas no banco de dados."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Administração" description="Gestão de dados e recursos do sistema." />
      <NotImplementedNotice
        title="Ferramentas administrativas em preparação"
        description="Sincronização oficial, tabela de preços e auditoria serão gerenciadas aqui."
      />
    </div>
  );
}
