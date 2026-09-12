CREATE POLICY "pools admin read"
ON public.pools FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "participants admin read"
ON public.pool_participants FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "payments admin read"
ON public.pool_payments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "pool games admin read"
ON public.pool_games FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "generated games admin read"
ON public.generated_games FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "game numbers admin read"
ON public.game_numbers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "pool events admin read"
ON public.pool_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "pool distributions admin read"
ON public.pool_prize_distributions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "pool distribution participants admin read"
ON public.pool_prize_participants FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "pool share links admin read"
ON public.pool_share_links FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE OR REPLACE FUNCTION public.pool_public_documents(_token text)
RETURNS TABLE(id uuid, title text, description text, mime_type text, file_size integer, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.title, d.description, d.mime_type, d.file_size, d.sort_order
  FROM public.pool_share_links link
  JOIN public.pool_documents d ON d.pool_id = link.pool_id
  WHERE link.token = _token
    AND link.revoked_at IS NULL
    AND link.scope IN ('GAMES', 'FULL')
    AND d.is_published
    AND d.deleted_at IS NULL
  ORDER BY d.sort_order, d.created_at, d.id;
$$;
REVOKE ALL ON FUNCTION public.pool_public_documents(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pool_public_documents(text) TO anon, authenticated, service_role;