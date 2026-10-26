import { createClient } from "@supabase/supabase-js";
import { RECOVERY_REDIRECT, recoveryError } from "./recovery";

/** Public Auth recovery endpoint, no privileged-key rate-limit bypass and no generated secret link. */
export async function sendOfficialRecovery(email: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("O envio de instruções está indisponível. Tente novamente em instantes.");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("apikey", key);
      if (headers.get("Authorization") === `Bearer ${key}` && key.startsWith("sb_")) headers.delete("Authorization");
      return fetch(input, { ...init, headers });
    } },
  });
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: RECOVERY_REDIRECT });
  if (error) throw new Error(recoveryError(error));
}