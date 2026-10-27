/**
 * Disponibilidade das modalidades (somente ADMIN).
 * A regra é verificada no banco (`has_role`) e a gravação é auditada pela
 * própria função `admin_set_lottery_availability`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSupabaseAuth } from "@/lib/auth/active-auth-middleware";

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const { data, error } = await (context.supabase as RpcClient).rpc("has_role", {
    _user_id: context.userId,
    _role: "ADMIN",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ação restrita a administradores.");
}

const inputSchema = z.object({
  slug: z.string().min(1).max(60),
  status: z.enum(["ENABLED", "MAINTENANCE", "DISABLED"]),
  note: z.string().trim().max(200).nullable().optional(),
});

export const setLotteryAvailability = createServerFn({ method: "POST" })
  .middleware([requireActiveSupabaseAuth])
  .inputValidator((input: z.input<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await (context.supabase as unknown as RpcClient).rpc(
      "admin_set_lottery_availability",
      { _slug: data.slug, _status: data.status, _note: data.note ?? null },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
