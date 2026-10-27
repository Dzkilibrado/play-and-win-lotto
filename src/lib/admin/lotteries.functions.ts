/**
 * Disponibilidade das modalidades (somente ADMIN).
 * A regra é verificada no banco (`has_role`) e a gravação é auditada pela
 * própria função `admin_set_lottery_availability`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireActiveSupabaseAuth } from "@/lib/auth/active-auth-middleware";
import { parseClubLines } from "@/lib/secondaryKeys";

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

const clubsSchema = z.object({
  slug: z.literal("timemania"),
  text: z.string().max(40_000),
});

/**
 * Substitui a lista de clubes ativos da Timemania pela lista colada.
 * Clubes que saem ficam inativos (jogos antigos continuam legíveis) e não
 * podem mais ser escolhidos em jogos novos. Só ADMIN (RLS + verificação).
 */
export const saveLotteryClubs = createServerFn({ method: "POST" })
  .middleware([requireActiveSupabaseAuth])
  .inputValidator((input: z.input<typeof clubsSchema>) => clubsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { clubs, invalid } = parseClubLines(data.text);
    if (invalid.length > 0) {
      throw new Error(`Linhas sem UF (use Nome/UF): ${invalid.slice(0, 5).join("; ")}`);
    }
    if (clubs.length === 0) throw new Error("Cole ao menos um clube.");

    type Db = {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
        };
        upsert: (
          rows: unknown[],
          options: { onConflict: string },
        ) => PromiseLike<{ error: { message: string } | null }>;
        update: (values: unknown) => {
          eq: (
            column: string,
            value: string,
          ) => {
            not: (
              column: string,
              operator: string,
              value: string,
            ) => PromiseLike<{ error: { message: string } | null }>;
          };
        };
      };
    };
    const db = context.supabase as unknown as Db;

    const lottery = await db.from("lotteries").select("id").eq("slug", data.slug);
    const lotteryId = (lottery.data as { id: string }[] | null)?.[0]?.id;
    if (lottery.error || !lotteryId) throw new Error("Modalidade não encontrada.");

    const { error: upsertError } = await db.from("lottery_secondary_options").upsert(
      clubs.map((club, index) => ({
        lottery_id: lotteryId,
        value: club.value,
        label: club.label,
        is_active: true,
        sort_order: index,
      })),
      { onConflict: "lottery_id,value" },
    );
    if (upsertError) throw new Error(upsertError.message);

    const keep = `(${clubs.map((club) => `"${club.value.replace(/"/g, "")}"`).join(",")})`;
    const { error: deactivateError } = await db
      .from("lottery_secondary_options")
      .update({ is_active: false })
      .eq("lottery_id", lotteryId)
      .not("value", "in", keep);
    if (deactivateError) throw new Error(deactivateError.message);

    return { ok: true as const, count: clubs.length };
  });
