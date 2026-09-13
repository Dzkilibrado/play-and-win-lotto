import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { DOCUMENT_MAX_FILE_SIZE, documentExtension, sniffDocumentMime, validateDocumentFile } from "@/lib/documents/documentFiles";

const DOCUMENT_BUCKET = "pool-documents";

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

async function requiredFile(form: FormData) {
  const value = form.get("file");
  if (!(value instanceof File) || value.size <= 0) throw new Error("Selecione um arquivo válido.");
  validateDocumentFile(value);
  if (value.size > DOCUMENT_MAX_FILE_SIZE) throw new Error("O arquivo deve ter no máximo 20 MB.");
  const bytes = new Uint8Array(await value.arrayBuffer());
  const mimeType = sniffDocumentMime(bytes);
  if (!mimeType || mimeType !== value.type) throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
  return { file: value, bytes, mimeType, originalFileName: value.name.slice(0, 255) };
}

async function assertCanManagePool(
  supabase: SupabaseClient<Database>,
  poolId: string,
) {
  const { data, error } = await supabase.rpc("can_manage_pool", { _pool_id: poolId });
  if (error || data !== true) throw new Error("Sem permissão para alterar comprovantes deste bolão.");
}

export const uploadPoolDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(requireFormData)
  .handler(async ({ data, context }) => {
    const poolId = z.string().uuid().parse(requiredText(data, "poolId"));
    const title = requiredText(data, "title");
    const descriptionValue = data.get("description");
    const description = typeof descriptionValue === "string" ? descriptionValue.trim() : "";
    const sortOrder = z.coerce.number().int().min(0).parse(data.get("sortOrder"));
    const { file, bytes, mimeType, originalFileName } = await requiredFile(data);
    await assertCanManagePool(context.supabase, poolId);

    const path = `${poolId}/${crypto.randomUUID()}.${documentExtension(mimeType)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) throw new Error("Não foi possível salvar o comprovante. Tente novamente.");

    const { data: document, error } = await context.supabase.rpc("pool_document_create", {
      _pool_id: poolId,
      _storage_path: path,
      _title: title,
      _description: description,
      _sort_order: sortOrder,
      _mime_type: mimeType,
      _file_size: file.size,
    });
    if (error) {
      const { error: cleanupError } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([path]);
      if (cleanupError) console.error("pool_document_upload_cleanup_failed", { path, message: cleanupError.message });
      throw new Error("Não foi possível salvar o comprovante. Tente novamente.");
    }
    if (document) await supabaseAdmin.from("pool_documents").update({ original_file_name: originalFileName }).eq("id", document.id);
    return document;
  });

export const replacePoolDocumentFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(requireFormData)
  .handler(async ({ data, context }) => {
    const documentId = z.string().uuid().parse(requiredText(data, "documentId"));
    const { file, bytes, mimeType, originalFileName } = await requiredFile(data);
    const { data: document, error: documentError } = await context.supabase
      .from("pool_documents")
      .select("id, pool_id, storage_path")
      .eq("id", documentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (documentError || !document) throw new Error("Comprovante não encontrado.");
    await assertCanManagePool(context.supabase, document.pool_id);

    const path = `${document.pool_id}/${crypto.randomUUID()}.${documentExtension(mimeType)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) throw new Error("Não foi possível substituir o arquivo. Tente novamente.");

    const { data: updated, error } = await context.supabase.rpc("pool_document_replace", {
      _document_id: documentId,
      _storage_path: path,
      _mime_type: mimeType,
      _file_size: file.size,
    });
    if (error) {
      const { error: cleanupError } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([path]);
      if (cleanupError) console.error("pool_document_replace_cleanup_failed", { path, message: cleanupError.message });
      throw new Error("Não foi possível substituir o arquivo. Tente novamente.");
    }
    await supabaseAdmin.from("pool_documents").update({ original_file_name: originalFileName }).eq("id", documentId);
    return updated;
  });

export const deletePoolDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => documentActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: document, error: documentError } = await context.supabase
      .from("pool_documents")
      .select("pool_id, storage_path")
      .eq("id", data.documentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (documentError || !document) throw new Error("Comprovante não encontrado.");
    await assertCanManagePool(context.supabase, document.pool_id);
    const { error } = await context.supabase.rpc("pool_document_delete", { _document_id: data.documentId });
    if (error) throw new Error("Não foi possível excluir o comprovante. Tente novamente.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: cleanupError } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([document.storage_path]);
    if (cleanupError) console.error("pool_document_delete_cleanup_failed", { path: document.storage_path, message: cleanupError.message });
    return { ok: true };
  });

export const getPoolDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => documentActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: document, error } = await context.supabase
      .from("pool_documents")
      .select("pool_id, storage_path")
      .eq("id", data.documentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !document) throw new Error("Comprovante não encontrado.");
    await assertCanManagePool(context.supabase, document.pool_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signedError } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).createSignedUrl(document.storage_path, 300);
    if (signedError) throw new Error("Não foi possível abrir o comprovante. Tente novamente.");
    return signed.signedUrl;
  });

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