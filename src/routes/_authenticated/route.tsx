import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    /*
     * A sessão já guardada no aparelho é lida localmente e a tela abre na
     * hora. Só quando não existe sessão local é que consultamos o servidor —
     * antes, toda troca de tela esperava uma ida e volta à rede.
     */
    // getUser valida a sessão no servidor; um token apenas persistido e já
    // expirado nunca é aceito como identidade válida para a rota protegida.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    const { data: status } = await supabase.rpc("profile_onboarding_status");
    if (!(status && typeof status === "object" && !Array.isArray(status) && status["complete"] === true)) throw redirect({ to: "/complete-profile" });
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    if (rolesError) throw rolesError;
    return {
      user: data.user,
      isAdmin: (roles ?? []).some((row) => row.role === "ADMIN"),
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = Route.useRouteContext();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    try {
      const { error } = await supabase.auth.signOut();
      if (error) await supabase.auth.signOut({ scope: "local" });
    } finally {
      queryClient.clear();
      navigate({ to: "/login", replace: true });
    }
  }

  return (
    <AppShell isAdmin={isAdmin} onSignOut={handleSignOut}>
      <Outlet />
    </AppShell>
  );
}
