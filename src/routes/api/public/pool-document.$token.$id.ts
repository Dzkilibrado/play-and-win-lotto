import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pool-document/$token/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: authorized, error } = await supabaseAdmin.rpc("pool_public_document_path", {
          _token: params.token,
          _document_id: params.id,
        });
        const document = authorized?.[0];
        if (error || !document) return new Response("Não encontrado", { status: 404, headers: { "cache-control": "no-store" } });

        const { data: signed, error: signedError } = await supabaseAdmin.storage
          .from("pool-documents")
          .createSignedUrl(document.storage_path, 120, {
            download: document.original_file_name || document.title,
          });
        if (signedError) return new Response("Não encontrado", { status: 404, headers: { "cache-control": "no-store" } });

        return new Response(null, {
          status: 302,
          headers: {
            location: signed.signedUrl,
            "cache-control": "private, no-store, max-age=0",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});