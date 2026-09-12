import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ token: z.string().min(1).max(200) });

export const getPublicPoolDocuments = createServerFn({ method: "GET" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("pool_public_documents", { _token: data.token });
    if (error) throw error;
    return (rows ?? []).map((row) => ({ ...row, url: `/api/public/pool-document/${encodeURIComponent(data.token)}/${row.id}` }));
  });