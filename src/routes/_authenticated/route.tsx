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
    const { data: local } = await supabase.auth.getSession();
    if (local.session?.user) return { user: local.session.user };

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <AppShell onSignOut={handleSignOut}>
      <Outlet />
    </AppShell>
  );
}
