import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pool-document/$token/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("pool_public_document_path", {
          _token: params.token,
          _document_id: params.id,
        });
        const document = data?.[0];
        if (error || !document) return new Response("Não encontrado", { status: 404 });

        const { data: file, error: downloadError } = await supabaseAdmin.storage
          .from("pool-documents")
          .download(document.storage_path);
        if (downloadError) return new Response("Não encontrado", { status: 404 });

        return new Response(file, {
          headers: {
            "content-type": document.mime_type ?? "application/octet-stream",
            "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.title)}`,
            "cache-control": "private, max-age=60",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});