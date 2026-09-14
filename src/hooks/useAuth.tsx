import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

const authenticatedRoute = getRouteApi("/_authenticated");

/** A rota protegida já validou esta identidade; não resolvemos uma segunda sessão concorrente. */
export function useSession() {
  const { user } = authenticatedRoute.useRouteContext();
  return { session: null, user, loading: false };
}

export function useProfile(user: User | null) {
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsAdmin(user: User | null) {
  return useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).some((row) => row.role === "ADMIN");
    },
  });
}
