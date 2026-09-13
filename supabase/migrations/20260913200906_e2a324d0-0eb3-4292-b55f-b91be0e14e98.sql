CREATE OR REPLACE VIEW public.pool_available_documents
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.pool_id,
  d.title,
  d.description,
  d.mime_type,
  d.file_size,
  d.sort_order,
  d.version,
  d.original_file_name,
  d.updated_at
FROM public.pool_documents AS d
WHERE d.deleted_at IS NULL
  AND d.is_published = true
  AND d.version >= 1
  AND d.storage_path IS NOT NULL
  AND length(trim(d.storage_path)) > 0
  AND d.mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  AND d.file_size IS NOT NULL
  AND d.file_size > 0;

GRANT SELECT ON public.pool_available_documents TO authenticated;
GRANT SELECT ON public.pool_available_documents TO service_role;
REVOKE ALL ON public.pool_available_documents FROM anon;

CREATE OR REPLACE FUNCTION public.pool_public_documents(_token text)
RETURNS TABLE(id uuid, title text, description text, mime_type text, file_size integer, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.title, d.description, d.mime_type, d.file_size, d.sort_order
  FROM public.pool_share_links AS link
  JOIN public.pool_available_documents AS d ON d.pool_id = link.pool_id
  WHERE link.token = _token
    AND link.revoked_at IS NULL
    AND link.scope IN ('GAMES', 'FULL')
  ORDER BY d.sort_order, d.updated_at, d.id;
$$;
REVOKE ALL ON FUNCTION public.pool_public_documents(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pool_public_documents(text) TO anon, authenticated, service_role;

UPDATE public.pool_documents
SET is_published = true
WHERE id = 'cbcb5e05-e110-41fa-8d48-167eb132e17f'::uuid
  AND pool_id = '03803466-851c-4768-a1e3-4cf906e538a5'::uuid
  AND deleted_at IS NULL
  AND version = 1
  AND original_file_name = 'DOC-20260912-WA0064.pdf'
  AND mime_type = 'application/pdf'
  AND file_size = 88974;

SELECT public.log_pool_event(
  '03803466-851c-4768-a1e3-4cf906e538a5'::uuid,
  'document_updated',
  'Comprovante atualizado',
  jsonb_build_object(
    'document_id', 'cbcb5e05-e110-41fa-8d48-167eb132e17f'::uuid,
    'published', true,
    'reason', 'restore_current_published_receipt'
  )
);