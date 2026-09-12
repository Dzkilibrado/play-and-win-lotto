import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOCUMENT_BUCKET = "pool-documents";
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;

const documentActionSchema = z.object({ documentId: z.string().uuid() });

function requireFormData(input: unknown) {
  if (!(input instanceof FormData)) throw new Error("Dados do comprovante inválidos.");
  return input;
}

function requiredText(form: FormData, key: string) {
  const value = form.get(key);
  if (typeof value !== "string" || value.trim() === "") throw new Error("Dados do comprovante inválidos.");
  return value.trim();
}

function requiredFile(form: FormData) {
  const value = form.get("file");
  if (!(value instanceof File) || value.size <= 0) throw new Error("Selecione um arquivo válido.");
  if (value.size > MAX_DOCUMENT_SIZE) throw new Error("O arquivo deve ter no máximo 20 MB.");
  if (!DOCUMENT_MIME_TYPES.some((mimeType) => mimeType === value.type)) throw new Error("Use um arquivo JPG, PNG ou PDF.");
  return value;
}

function extensionFor(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

async function assertCanManagePool(
  supabase: Parameters<Parameters<typeof requireSupabaseAuth["options"]["server"]>[0]>[0]["context"]["supabase"],
  poolId: string,
) {
  const { data, error } = await supabase.rpc("can_manage_pool", { _pool_id: poolId });
  if (error || data !== true) throw new Error("Sem permissão para alterar comprovantes deste bolão.");
}

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