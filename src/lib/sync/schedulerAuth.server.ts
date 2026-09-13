export async function authenticateDatabaseScheduler(request: Request): Promise<boolean> {
  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
  }).rpc("verify_sync_scheduler_token", { _token: token });
  return !error && data === true;
}