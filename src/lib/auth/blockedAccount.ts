export const BLOCKED_LOGIN_MESSAGE = "Seu acesso ao Gestor da Sorte está temporariamente indisponível.";

export function isBlockedAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const value = `${String(candidate.code ?? "")} ${String(candidate.message ?? "")}`.toLowerCase();
  return value.includes("user_banned") || value.includes("banned") || value.includes("blocked") || value.includes("account_blocked");
}