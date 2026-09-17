import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSupabaseAuth } from "@/lib/auth/active-auth-middleware";

const filtersSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "PENDING", "BLOCKED"]).nullable().default(null),
  role: z.enum(["USER", "ADMIN"]).nullable().default(null),
  provider: z.enum(["email", "google"]).nullable().default(null),
  createdPeriod: z.enum(["TODAY", "7D", "30D", "90D"]).nullable().default(null),
  accessPeriod: z.enum(["TODAY", "7D", "30D", "STALE", "NEVER"]).nullable().default(null),
  sort: z.enum(["CREATED_DESC", "CREATED_ASC", "ACCESS_DESC", "NAME_ASC", "NAME_DESC"]).default("CREATED_DESC"),
});

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  status: z.enum(["ACTIVE", "PENDING", "BLOCKED"]),
  providers: z.array(z.string()),
  createdAt: z.string(),
  lastAccessAt: z.string().nullable(),
  isSystemOwner: z.boolean(),
});

const accessActionSchema = z.object({
  targetUserId: z.string().uuid(),
  action: z.enum(["BLOCK", "UNBLOCK"]),
  reason: z.enum(["ADMIN_REQUEST", "SECURITY", "MISUSE", "OTHER"]).nullable().default(null),
  reasonDetails: z.string().trim().max(160).nullable().default(null),
}).superRefine((value, context) => {
  if (value.reason === "OTHER" && !value.reasonDetails) {
    context.addIssue({ code: "custom", path: ["reasonDetails"], message: "Descreva o motivo." });
  }
});

const responseSchema = z.object({
  items: z.array(userSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    users: z.number().int().nonnegative(),
    admins: z.number().int().nonnegative(),
  }),
  availableProviders: z.array(z.string()),
});

export type AdminUsersInput = z.infer<typeof filtersSchema>;
export type AdminUsersResult = z.infer<typeof responseSchema>;

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireActiveSupabaseAuth])
  .inputValidator((input) => filtersSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ADMIN",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpcArgs = {
      _requester_id: context.userId,
      _page: data.page,
      _page_size: data.pageSize,
      _sort: data.sort,
      ...(data.status ? { _status: data.status } : {}),
      ...(data.role ? { _role: data.role } : {}),
      ...(data.provider ? { _provider: data.provider } : {}),
      ...(data.createdPeriod ? { _created_period: data.createdPeriod } : {}),
      ...(data.accessPeriod ? { _access_period: data.accessPeriod } : {}),
    };
    const { data: result, error } = await supabaseAdmin.rpc("admin_list_users_v2", rpcArgs);
    if (error) throw new Error(error.message);
    return responseSchema.parse(result);
  });

export const changeAdminUserAccess = createServerFn({ method: "POST" })
  .middleware([requireActiveSupabaseAuth])
  .inputValidator((input) => accessActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ADMIN",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    if (data.targetUserId === context.userId && data.action === "BLOCK") {
      throw new Error("Você não pode bloquear sua própria conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: settings, error: settingsError }, { data: targetResult, error: targetError }] = await Promise.all([
      supabaseAdmin.from("system_settings").select("system_owner_user_id").eq("singleton", true).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(data.targetUserId),
    ]);
    if (settingsError) throw new Error("Não foi possível validar o responsável principal.");
    if (targetError || !targetResult.user) throw new Error("Usuário não encontrado.");
    if (settings?.system_owner_user_id === data.targetUserId && data.action === "BLOCK") {
      throw new Error("O responsável principal não pode ser bloqueado.");
    }

    const currentlyBlocked = Boolean(
      targetResult.user.banned_until && new Date(targetResult.user.banned_until).getTime() > Date.now(),
    );
    if ((data.action === "BLOCK" && currentlyBlocked) || (data.action === "UNBLOCK" && !currentlyBlocked)) {
      throw new Error(data.action === "BLOCK" ? "Este usuário já está bloqueado." : "Este usuário já está com acesso ativo.");
    }

    if (data.action === "BLOCK") {
      const { data: targetRoles, error: targetRolesError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.targetUserId);
      if (targetRolesError) throw new Error("Não foi possível validar as permissões da conta.");
      if ((targetRoles ?? []).some((row) => row.role === "ADMIN")) {
        const { data: activeAdmins, error: adminsError } = await supabaseAdmin.rpc("admin_active_count");
        if (adminsError) throw new Error("Não foi possível validar a continuidade administrativa.");
        if (Number(activeAdmins) <= 1) throw new Error("O último administrador ativo não pode ser bloqueado.");
      }
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      ban_duration: data.action === "BLOCK" ? "876000h" : "none",
    });
    if (updateError) throw new Error("Não foi possível atualizar o acesso deste usuário.");

    const auditMetadata = data.reason
      ? { target_user_id: data.targetUserId, reason: data.reason, ...(data.reasonDetails ? { reason_details: data.reasonDetails } : {}) }
      : { target_user_id: data.targetUserId };
    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      entity_type: "USER_ACCESS",
      entity_id: data.targetUserId,
      action: data.action === "BLOCK" ? "USER_BLOCKED" : "USER_UNBLOCKED",
      metadata: auditMetadata,
    });
    if (auditError) {
      await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
        ban_duration: data.action === "BLOCK" ? "none" : "876000h",
      });
      throw new Error("A alteração não foi concluída porque a auditoria não pôde ser registrada.");
    }

    return { ok: true, status: data.action === "BLOCK" ? "BLOCKED" as const : "ACTIVE" as const };
  });