import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "./client";

const REFRESH_MARGIN_SECONDS = 60;

/** Garante um token atual antes de cada operação autenticada do aplicativo. */
export const attachRefreshedSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    const expiresSoon = session?.expires_at
      ? session.expires_at <= Math.floor(Date.now() / 1000) + REFRESH_MARGIN_SECONDS
      : false;

    if (session && expiresSoon) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
    }

    const token = session?.access_token;
    try {
      return await next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("ACCOUNT_BLOCKED")) {
        await supabase.auth.signOut({ scope: "local" });
        window.dispatchEvent(new CustomEvent("gestor:account-blocked"));
      }
      throw error;
    }
  },
);