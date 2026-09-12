REVOKE EXECUTE ON FUNCTION public.pool_attach_games(uuid, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pool_set_share_link(uuid, public.pool_share_scope, boolean, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pool_set_public(uuid, boolean) FROM anon;

GRANT EXECUTE ON FUNCTION public.pool_attach_games(uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pool_set_share_link(uuid, public.pool_share_scope, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pool_set_public(uuid, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pool_public_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pool_public_summary(text) TO anon, authenticated, service_role;