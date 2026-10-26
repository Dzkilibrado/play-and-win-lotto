import { hasLocalPassword } from "@/lib/auth/recovery";

export type RecoveryTarget = { email?: string; identities?: { provider: string }[] };
export type AdminRecoveryDependencies = {
  authorize: () => Promise<boolean>;
  target: (id: string) => Promise<RecoveryTarget | null>;
  audit: (id: string) => Promise<void>;
  send: (email: string) => Promise<void>;
};

/** Audit denotes a request, not delivery: fail closed before dispatch if audit is unavailable. */
export async function performAdminRecovery(targetId: string, dependencies: AdminRecoveryDependencies) {
  if (!await dependencies.authorize()) throw new Error("Acesso restrito a administradores.");
  const target = await dependencies.target(targetId);
  if (!target?.email || !hasLocalPassword((target.identities ?? []).map((identity) => identity.provider))) {
    throw new Error("Esta conta não possui método local de senha disponível para redefinição.");
  }
  await dependencies.audit(targetId);
  await dependencies.send(target.email);
  return { ok: true as const };
}