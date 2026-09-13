import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pool-document/$token/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: links, error: linkError } = await supabaseAdmin.from("pool_share_links").select("pool_id, scope").eq("token", params.token).is("revoked_at", null).in("scope", ["GAMES", "FULL"]).limit(1);
        const link = links?.[0];
        if (linkError || !link) return new Response("Não encontrado", { status: 404 });
        const { data: document, error } = await supabaseAdmin.from("pool_documents").select("storage_path, mime_type, title, original_file_name").eq("id", params.id).eq("pool_id", link.pool_id).eq("is_published", true).is("deleted_at", null).maybeSingle();
        if (error || !document) return new Response("Não encontrado", { status: 404 });

        const { data: file, error: downloadError } = await supabaseAdmin.storage
          .from("pool-documents")
          .download(document.storage_path);
        if (downloadError) return new Response("Não encontrado", { status: 404 });

        return new Response(file, {
          headers: {
            "content-type": document.mime_type ?? "application/octet-stream",
            "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.original_file_name || document.title)}`,
            "cache-control": "private, max-age=60",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});