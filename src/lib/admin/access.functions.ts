import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSupabaseAuth } from "@/lib/auth/active-auth-middleware";

import { normalizeMatrix } from "./permissions";

const permissionRowSchema = z.object({
  module: z.string().min(1).max(40),
  view: z.boolean(),
  create: z.boolean(),
  edit: z.boolean(),
  delete: z.boolean(),
});

const roleChangeSchema = z
  .object({
    targetUserId: z.string().uuid(),
    role: z.enum(["USER", "SUPORTE", "ADMIN"]),
    reason: z.enum(["ADMIN_REQUEST", "TEAM_CHANGE", "SECURITY", "OTHER"]).nullable().default(null),
    reasonDetails: z.string().trim().max(160).nullable().default(null),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.reason === "OTHER" && !value.reasonDetails) {
      context.addIssue({ code: "custom", path: ["reasonDetails"], message: "Descreva o motivo." });
    }
  });

type RpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const client = context.supabase as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (error) throw new Error("Não foi possível validar o seu acesso.");
  if (data !== true) throw new Error("Acesso restrito a administradores.");
}

async function adminRpc(): Promise<RpcClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as RpcClient;
}

/** Mensagens do banco já são em português e seguras para exibir; as demais viram texto genérico. */
function friendly(message: string, fallback: string): string {
  return /^(Você|O |Esta |Descreva|Usuário|Somente|Módulo|Acesso|Motivo|Permissões)/.test(message)
    ? message
    : fallback;
}

export const getSupportPermissions = createServerFn({ method: "GET" })
  .middleware([requireActiveSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const client = await adminRpc();
    const { data, error } = await client.rpc("admin_get_role_permissions", {
      _actor: context.userId,
      _role: "SUPORTE",
    });
    if (error) throw new Error(friendly(error.message, "Não foi possível carregar as permissões."));
    return normalizeMatrix(data);
  });

export const saveSupportPermissions = createServerFn({ method: "POST" })
  .middleware([requireActiveSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ permissions: z.array(permissionRowSchema).max(40) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const client = await adminRpc();
    const { error } = await client.rpc("admin_set_role_permissions", {
      _actor: context.userId,
      _role: "SUPORTE",
      _permissions: data.permissions,
    });
    if (error) throw new Error(friendly(error.message, "Não foi possível salvar as permissões."));
    return { ok: true as const };
  });

export const changeAdminUserRole = createServerFn({ method: "POST" })
  .middleware([requireActiveSupabaseAuth])
  .inputValidator((input) => roleChangeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const client = await adminRpc();
    const { error } = await client.rpc("admin_set_user_role", {
      _actor: context.userId,
      _target: data.targetUserId,
      _role: data.role,
      _reason: data.reason,
      _details: data.reasonDetails,
    });
    if (error)
      throw new Error(friendly(error.message, "Não foi possível alterar o tipo de acesso."));
    return { ok: true as const, role: data.role };
  });
