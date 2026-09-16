REVOKE ALL ON FUNCTION public.reconcile_pool_lifecycle_from_draw() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_pool_lifecycle_from_check() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_pool_lifecycle_from_game_link() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_pool_lifecycle_from_draw() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_pool_lifecycle_from_check() TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_pool_lifecycle_from_game_link() TO service_role;