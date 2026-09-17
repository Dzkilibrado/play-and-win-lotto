import { createMiddleware } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ACCOUNT_BLOCKED_ERROR = "ACCOUNT_BLOCKED";

/**
 * Revalida a conta no provedor de autenticação em cada operação protegida.
 * Diferente da validação local do JWT, esta consulta detecta bloqueios feitos
 * depois que uma sessão já foi emitida.
 */
export const requireActiveSupabaseAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase.auth.getUser();
    if (error || !data.user || data.user.id !== context.userId) {
      const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
      if (message.includes("ban") || message.includes("block")) {
        throw new Error(ACCOUNT_BLOCKED_ERROR);
      }
      throw new Error("Unauthorized: Invalid or inactive account");
    }
    return next();
  });