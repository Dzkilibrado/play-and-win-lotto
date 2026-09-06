
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_pool_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_pool_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_game(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pool_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pool_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_game(uuid) TO authenticated;
