import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  name: z.string(),
  email: z.string(),
  role: z.enum(["USER", "ADMIN"]),
  status: z.enum(["ACTIVE", "PENDING", "BLOCKED"]),
  providers: z.array(z.string()),
  createdAt: z.string(),
  lastAccessAt: z.string().nullable(),
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => filtersSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "ADMIN",
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("admin_list_users_v2", {
      _requester_id: context.userId,
      _page: data.page,
      _page_size: data.pageSize,
      _status: data.status,
      _role: data.role,
      _provider: data.provider,
      _created_period: data.createdPeriod,
      _access_period: data.accessPeriod,
      _sort: data.sort,
    });
    if (error) throw new Error(error.message);
    return responseSchema.parse(result);
  });