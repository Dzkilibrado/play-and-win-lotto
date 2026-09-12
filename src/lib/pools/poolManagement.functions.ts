import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deletePoolSchema = z.object({
  poolId: z.string().uuid(),
  confirmation: z.literal("EXCLUIR"),
});

type DeleteResult = {
  cleanupJobId: string;
  storagePaths: string[];
  summary: Record<string, number>;
};

export const deletePoolPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => deletePoolSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: raw, error } = await context.supabase.rpc("pool_delete_permanently", {
      _pool_id: data.poolId,
      _confirmation: data.confirmation,
    });
    if (error) throw error;

    const result = raw as unknown as DeleteResult;
    const paths = Array.isArray(result.storagePaths) ? result.storagePaths : [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (paths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage.from("pool-documents").remove(paths);
      if (storageError) {
        await supabaseAdmin
          .from("pool_storage_cleanup_jobs")
          .update({ status: "FAILED", last_error: storageError.message })
          .eq("id", result.cleanupJobId);
        return { ...result, cleanupPending: true };
      }
    }

    await supabaseAdmin
      .from("pool_storage_cleanup_jobs")
      .update({ status: "COMPLETED", completed_at: new Date().toISOString(), last_error: null })
      .eq("id", result.cleanupJobId);
    return { ...result, cleanupPending: false };
  });