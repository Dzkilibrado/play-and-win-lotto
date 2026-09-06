import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/common/StateViews";
import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { appConfig } from "@/config/app.config";
import { useProfile, useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: `Perfil — ${appConfig.name}` },
      { name: "description", content: "Seus dados de conta." },
      { property: "og:title", content: `Perfil — ${appConfig.name}` },
      { property: "og:description", content: "Seus dados de conta." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useSession();
  const profile = useProfile(user);

  return (
    <div className="space-y-4">
      <PageHeader title="Perfil" description="Dados da sua conta." />
      {profile.isLoading ? (
        <LoadingState rows={1} />
      ) : (
        <dl className="surface-card grid gap-3 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-secondary">Nome</dt>
            <dd className="font-medium text-text-primary">
              {profile.data?.display_name ?? "Não informado"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">E-mail</dt>
            <dd className="font-medium text-text-primary">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Telefone</dt>
            <dd className="font-medium text-text-primary">
              {profile.data?.phone ?? "Não informado"}
            </dd>
          </div>
        </dl>
      )}
      <NotImplementedNotice
        title="Edição de perfil em preparação"
        description="A alteração de nome, telefone e avatar será liberada em seguida."
      />
    </div>
  );
}
