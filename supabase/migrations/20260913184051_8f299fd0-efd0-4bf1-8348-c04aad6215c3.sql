DROP FUNCTION IF EXISTS public.pool_document_create(uuid, text, text, text, integer, text, integer);
DROP FUNCTION IF EXISTS public.pool_document_replace(uuid, text, text, integer);

CREATE OR REPLACE FUNCTION public.pool_document_create(
  _pool_id uuid,
  _storage_path text,
  _title text,
  _description text,
  _sort_order integer,
  _mime_type text,
  _file_size integer,
  _original_file_name text
)
RETURNS public.pool_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _document public.pool_documents%ROWTYPE;
BEGIN
  IF NOT public.can_manage_pool(_pool_id) THEN
    RAISE EXCEPTION 'Apenas o organizador ou um administrador pode anexar comprovantes.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pools WHERE id = _pool_id AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Restaure o bolão antes de alterar comprovantes.' USING ERRCODE = '42501';
  END IF;
  IF trim(COALESCE(_title, '')) = '' THEN RAISE EXCEPTION 'Informe o título do comprovante.' USING ERRCODE = '22023'; END IF;
  IF _mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN RAISE EXCEPTION 'Formato de arquivo não permitido.' USING ERRCODE = '22023'; END IF;
  IF _file_size IS NULL OR _file_size <= 0 OR _file_size > 20971520 THEN RAISE EXCEPTION 'O arquivo deve ter no máximo 20 MB.' USING ERRCODE = '22023'; END IF;
  IF _storage_path NOT LIKE _pool_id::text || '/%' THEN RAISE EXCEPTION 'Caminho de arquivo inválido.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.pool_documents(pool_id, uploaded_by, kind, storage_path, title, description, sort_order, mime_type, file_size, original_file_name, is_published)
  VALUES (_pool_id, auth.uid(), 'GAME_RECEIPT', _storage_path, trim(_title), NULLIF(trim(COALESCE(_description, '')), ''), GREATEST(COALESCE(_sort_order, 0), 0), _mime_type, _file_size, NULLIF(trim(COALESCE(_original_file_name, '')), ''), false)
  RETURNING * INTO _document;

  PERFORM public.log_pool_event(_pool_id, 'document_uploaded', 'Comprovante anexado', jsonb_build_object('document_id', _document.id, 'title', _document.title));
  RETURN _document;
END;
$$;

CREATE OR REPLACE FUNCTION public.pool_document_replace(
  _document_id uuid,
  _storage_path text,
  _mime_type text,
  _file_size integer,
  _original_file_name text
)
RETURNS public.pool_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _document public.pool_documents%ROWTYPE;
BEGIN
  SELECT * INTO _document FROM public.pool_documents WHERE id = _document_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comprovante não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_pool(_document.pool_id) THEN RAISE EXCEPTION 'Sem permissão para substituir este comprovante.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.pools WHERE id = _document.pool_id AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Restaure o bolão antes de alterar comprovantes.' USING ERRCODE = '42501';
  END IF;
  IF _mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN RAISE EXCEPTION 'Formato de arquivo não permitido.' USING ERRCODE = '22023'; END IF;
  IF _file_size IS NULL OR _file_size <= 0 OR _file_size > 20971520 THEN RAISE EXCEPTION 'O arquivo deve ter no máximo 20 MB.' USING ERRCODE = '22023'; END IF;
  IF _storage_path NOT LIKE _document.pool_id::text || '/%' THEN RAISE EXCEPTION 'Caminho de arquivo inválido.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.pool_document_versions(document_id, version, storage_path, mime_type, file_size, original_file_name, replaced_by)
  VALUES (_document.id, _document.version, _document.storage_path, _document.mime_type, _document.file_size, _document.original_file_name, auth.uid());

  UPDATE public.pool_documents
  SET storage_path = _storage_path,
      mime_type = _mime_type,
      file_size = _file_size,
      original_file_name = NULLIF(trim(COALESCE(_original_file_name, '')), ''),
      version = version + 1
  WHERE id = _document_id
  RETURNING * INTO _document;

  PERFORM public.log_pool_event(_document.pool_id, 'document_replaced', 'Arquivo do comprovante substituído', jsonb_build_object('document_id', _document.id, 'version', _document.version));
  RETURN _document;
END;
$$;

REVOKE ALL ON FUNCTION public.pool_document_create(uuid, text, text, text, integer, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pool_document_replace(uuid, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_document_create(uuid, text, text, text, integer, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pool_document_replace(uuid, text, text, integer, text) TO authenticated, service_role;

DROP FUNCTION public.pool_public_document_path(text, uuid);
CREATE OR REPLACE FUNCTION public.pool_public_document_path(_token text, _document_id uuid)
RETURNS TABLE(storage_path text, mime_type text, title text, original_file_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.storage_path, d.mime_type, d.title, d.original_file_name
  FROM public.pool_share_links link
  JOIN public.pool_documents d ON d.pool_id = link.pool_id
  WHERE link.token = _token
    AND link.revoked_at IS NULL
    AND link.scope IN ('GAMES', 'FULL')
    AND d.id = _document_id
    AND d.is_published
    AND d.deleted_at IS NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.pool_public_document_path(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pool_public_document_path(text, uuid) TO service_role;

DROP POLICY IF EXISTS "flags public read" ON public.feature_flags;
REVOKE SELECT ON public.feature_flags FROM anon;
CREATE POLICY "flags admin read"
ON public.feature_flags FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));
