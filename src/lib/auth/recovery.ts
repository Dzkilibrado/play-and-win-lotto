import { z } from "zod";
import { appConfig } from "@/config/app.config";

export const RECOVERY_REDIRECT = `${appConfig.canonicalOrigin}/reset-password`;
export const RECOVERY_NEUTRAL_MESSAGE = "Se existir uma conta associada a este e-mail, enviaremos instruções para redefinição de senha.";
export const RECOVERY_INVALID_MESSAGE = "Este link de redefinição não é mais válido.";
export const RECOVERY_WAIT_MESSAGE = "Aguarde um momento antes de solicitar um novo e-mail.";

export function hasLocalPassword(providers: readonly string[]) {
  return providers.some((provider) => provider.toLowerCase() === "email");
}

export function isRecoveryClaims(claims: { amr?: unknown; exp?: unknown } | null | undefined, now = Date.now()) {
  if (!claims || typeof claims.exp !== "number" || claims.exp * 1000 <= now || !Array.isArray(claims.amr)) return false;
  return claims.amr.some((entry: unknown) => typeof entry === "object" && entry !== null && "method" in entry && entry.method === "recovery");
}

export const recoveryPasswordSchema = z.object({
  password: z.string().min(1, "Informe a nova senha."),
  confirmation: z.string().min(1, "Confirme a nova senha."),
}).refine((value) => value.password === value.confirmation, {
  path: ["confirmation"], message: "As senhas informadas não coincidem.",
});

export function recoveryError(error: { code?: unknown; status?: unknown } | null | undefined) {
  if (error?.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit", "over_email_send_rate_limit", "email_send_rate_limit"].includes(String(error?.code))) return RECOVERY_WAIT_MESSAGE;
  if (error?.code === "same_password") return "A nova senha deve ser diferente da senha atual.";
  if (error?.code === "weak_password") return "A nova senha não atende aos critérios de segurança da sua conta. Escolha outra senha.";
  if (["otp_expired", "session_not_found", "bad_jwt", "refresh_token_not_found", "refresh_token_already_used"].includes(String(error?.code))) return RECOVERY_INVALID_MESSAGE;
  return "Não foi possível concluir a solicitação. Tente novamente em instantes.";
}

export async function requestRecovery(send: () => Promise<{ error: { code?: string; status?: number } | null }>) {
  try {
    const { error } = await send();
    // Never expose account existence or its provider through the public result.
    if (!error || ["user_not_found", "email_not_confirmed", "user_banned"].includes(error.code ?? "")) return { accepted: true as const };
    return { accepted: false as const, message: recoveryError(error) };
  } catch {
    return { accepted: false as const, message: recoveryError(null) };
  }
}