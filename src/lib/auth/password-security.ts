import type { User } from "@supabase/supabase-js";
import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual").max(72),
    newPassword: z.string().min(8, "Use pelo menos 8 caracteres").max(72),
    confirmation: z.string().min(1, "Confirme a nova senha").max(72),
  })
  .refine((data) => data.newPassword === data.confirmation, {
    path: ["confirmation"],
    message: "As novas senhas não coincidem.",
  });

export type AccountMethods = {
  hasPassword: boolean;
  hasGoogle: boolean;
  labels: string[];
};

export function getAccountMethods(user: User | null): AccountMethods {
  const providers = new Set(
    (user?.identities ?? [])
      .map((identity) => identity.provider.toLowerCase())
      .filter(Boolean),
  );

  const hasPassword = providers.has("email");
  const hasGoogle = providers.has("google");
  const labels = [hasPassword ? "E-mail e senha" : null, hasGoogle ? "Google" : null].filter(
    (label): label is string => Boolean(label),
  );

  return { hasPassword, hasGoogle, labels };
}

type SafeAuthError = { code?: unknown; status?: unknown } | null;

function authErrorCode(error: SafeAuthError) {
  return typeof error?.code === "string" ? error.code : "";
}

export function passwordChangeError(error: SafeAuthError) {
  const code = authErrorCode(error);
  if (error?.status === 429 || code === "over_request_rate_limit") {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  if (code === "weak_password") {
    return "A nova senha não atende aos requisitos de segurança.";
  }
  if (code === "same_password") {
    return "A nova senha deve ser diferente da senha atual.";
  }
  return "Não foi possível alterar a senha. Tente novamente.";
}

export function currentPasswordError(error: SafeAuthError) {
  if (error?.status === 429 || authErrorCode(error) === "over_request_rate_limit") {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  return "A senha atual informada está incorreta.";
}