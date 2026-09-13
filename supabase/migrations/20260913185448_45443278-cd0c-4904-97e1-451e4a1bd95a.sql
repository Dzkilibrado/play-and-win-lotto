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