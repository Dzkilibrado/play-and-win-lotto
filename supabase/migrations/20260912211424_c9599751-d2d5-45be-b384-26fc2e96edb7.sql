ALTER TABLE public.pools
  ADD COLUMN archived_at timestamptz;

ALTER TABLE public.pool_documents
  ADD COLUMN title text,
  ADD COLUMN description text,
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN version integer NOT NULL DEFAULT 1;

UPDATE public.pool_documents
SET title = 'Comprovante ' || row_number_value::text
FROM (
  SELECT id, row_number() OVER (PARTITION BY pool_id ORDER BY created_at, id) AS row_number_value
  FROM public.pool_documents
) numbered
WHERE public.pool_documents.id = numbered.id
  AND public.pool_documents.title IS NULL;

ALTER TABLE public.pool_documents
  ALTER COLUMN title SET NOT NULL;

CREATE TRIGGER pool_documents_updated_at
BEFORE UPDATE ON public.pool_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pool_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.pool_documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size integer,
  replaced_by uuid,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
GRANT SELECT ON public.pool_document_versions TO authenticated;
GRANT ALL ON public.pool_document_versions TO service_role;
ALTER TABLE public.pool_document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "document versions manager read"
ON public.pool_document_versions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pool_documents d
    WHERE d.id = document_id
      AND (public.is_pool_owner(d.pool_id) OR public.has_role(auth.uid(), 'ADMIN'))
  )
);

CREATE TABLE public.pool_storage_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  storage_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pool_storage_cleanup_jobs TO authenticated;
GRANT ALL ON public.pool_storage_cleanup_jobs TO service_role;
ALTER TABLE public.pool_storage_cleanup_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cleanup requester read"
ON public.pool_storage_cleanup_jobs FOR SELECT TO authenticated
USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER pool_storage_cleanup_jobs_updated_at
BEFORE UPDATE ON public.pool_storage_cleanup_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_pool(_pool_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.pools p WHERE p.id = _pool_id AND p.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'ADMIN')
  );
$$;
REVOKE ALL ON FUNCTION public.can_manage_pool(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_pool(uuid) TO authenticated, service_role;

CREATE POLICY "pool documents admin read"
ON public.pool_documents FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "pool documents admin write"
ON public.pool_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE POLICY "pool document files manager select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pool-documents'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.can_manage_pool(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "pool document files manager insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pool-documents'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.can_manage_pool(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "pool document files manager update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pool-documents'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.can_manage_pool(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'pool-documents'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.can_manage_pool(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "pool document files manager delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pool-documents'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.can_manage_pool(((storage.foldername(name))[1])::uuid)
);

CREATE OR REPLACE FUNCTION public.pool_set_archived(_pool_id uuid, _archived boolean)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pool public.pools%ROWTYPE;
  _archived_at timestamptz;
BEGIN
  IF NOT public.can_manage_pool(_pool_id) THEN
    RAISE EXCEPTION 'Apenas o organizador ou um administrador pode alterar o arquivamento.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _pool FROM public.pools WHERE id = _pool_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bolão não encontrado.' USING ERRCODE = 'P0002'; END IF;

  _archived_at := CASE WHEN _archived THEN COALESCE(_pool.archived_at, now()) ELSE NULL END;
  UPDATE public.pools SET archived_at = _archived_at WHERE id = _pool_id;

  IF (_archived AND _pool.archived_at IS NULL) OR (NOT _archived AND _pool.archived_at IS NOT NULL) THEN
    PERFORM public.log_pool_event(
      _pool_id,
      CASE WHEN _archived THEN 'pool_archived' ELSE 'pool_restored' END,
      CASE WHEN _archived THEN 'Bolão arquivado' ELSE 'Bolão restaurado' END,
      jsonb_build_object('operational_status', _pool.status)
    );
  END IF;

  RETURN _archived_at;
END;
$$;
REVOKE ALL ON FUNCTION public.pool_set_archived(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_set_archived(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pool_document_create(
  _pool_id uuid,
  _storage_path text,
  _title text,
  _description text,
  _sort_order integer,
  _mime_type text,
  _file_size integer
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
  IF _mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf') THEN RAISE EXCEPTION 'Formato de arquivo não permitido.' USING ERRCODE = '22023'; END IF;
  IF _file_size IS NULL OR _file_size <= 0 OR _file_size > 20971520 THEN RAISE EXCEPTION 'O arquivo deve ter no máximo 20 MB.' USING ERRCODE = '22023'; END IF;
  IF _storage_path NOT LIKE _pool_id::text || '/%' THEN RAISE EXCEPTION 'Caminho de arquivo inválido.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.pool_documents(pool_id, uploaded_by, kind, storage_path, title, description, sort_order, mime_type, file_size, is_published)
  VALUES (_pool_id, auth.uid(), 'GAME_RECEIPT', _storage_path, trim(_title), NULLIF(trim(COALESCE(_description, '')), ''), GREATEST(COALESCE(_sort_order, 0), 0), _mime_type, _file_size, false)
  RETURNING * INTO _document;

  PERFORM public.log_pool_event(_pool_id, 'document_uploaded', 'Comprovante anexado', jsonb_build_object('document_id', _document.id, 'title', _document.title));
  RETURN _document;
END;
$$;

CREATE OR REPLACE FUNCTION public.pool_document_update(
  _document_id uuid,
  _title text,
  _description text,
  _sort_order integer,
  _is_published boolean
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
  IF NOT public.can_manage_pool(_document.pool_id) THEN RAISE EXCEPTION 'Sem permissão para editar este comprovante.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.pools WHERE id = _document.pool_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaure o bolão antes de alterar comprovantes.' USING ERRCODE = '42501'; END IF;
  IF trim(COALESCE(_title, '')) = '' THEN RAISE EXCEPTION 'Informe o título do comprovante.' USING ERRCODE = '22023'; END IF;

  UPDATE public.pool_documents
  SET title = trim(_title), description = NULLIF(trim(COALESCE(_description, '')), ''), sort_order = GREATEST(COALESCE(_sort_order, 0), 0), is_published = COALESCE(_is_published, false)
  WHERE id = _document_id RETURNING * INTO _document;
  PERFORM public.log_pool_event(_document.pool_id, 'document_updated', 'Comprovante atualizado', jsonb_build_object('document_id', _document.id, 'published', _document.is_published));
  RETURN _document;
END;
$$;

CREATE OR REPLACE FUNCTION public.pool_document_replace(
  _document_id uuid,
  _storage_path text,
  _mime_type text,
  _file_size integer
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
  IF EXISTS (SELECT 1 FROM public.pools WHERE id = _document.pool_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaure o bolão antes de alterar comprovantes.' USING ERRCODE = '42501'; END IF;
  IF _mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf') THEN RAISE EXCEPTION 'Formato de arquivo não permitido.' USING ERRCODE = '22023'; END IF;
  IF _file_size IS NULL OR _file_size <= 0 OR _file_size > 20971520 THEN RAISE EXCEPTION 'O arquivo deve ter no máximo 20 MB.' USING ERRCODE = '22023'; END IF;
  IF _storage_path NOT LIKE _document.pool_id::text || '/%' THEN RAISE EXCEPTION 'Caminho de arquivo inválido.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.pool_document_versions(document_id, version, storage_path, mime_type, file_size, replaced_by)
  VALUES (_document.id, _document.version, _document.storage_path, _document.mime_type, _document.file_size, auth.uid());

  UPDATE public.pool_documents
  SET storage_path = _storage_path, mime_type = _mime_type, file_size = _file_size, version = version + 1
  WHERE id = _document_id RETURNING * INTO _document;
  PERFORM public.log_pool_event(_document.pool_id, 'document_replaced', 'Arquivo do comprovante substituído', jsonb_build_object('document_id', _document.id, 'version', _document.version));
  RETURN _document;
END;
$$;

CREATE OR REPLACE FUNCTION public.pool_document_delete(_document_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _document public.pool_documents%ROWTYPE;
BEGIN
  SELECT * INTO _document FROM public.pool_documents WHERE id = _document_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comprovante não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_pool(_document.pool_id) THEN RAISE EXCEPTION 'Sem permissão para excluir este comprovante.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.pools WHERE id = _document.pool_id AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaure o bolão antes de alterar comprovantes.' USING ERRCODE = '42501'; END IF;

  UPDATE public.pool_documents SET deleted_at = now(), is_published = false WHERE id = _document_id;
  PERFORM public.log_pool_event(_document.pool_id, 'document_deleted', 'Comprovante excluído', jsonb_build_object('document_id', _document.id, 'title', _document.title));
  RETURN _document.storage_path;
END;
$$;

REVOKE ALL ON FUNCTION public.pool_document_create(uuid, text, text, text, integer, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pool_document_update(uuid, text, text, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pool_document_replace(uuid, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pool_document_delete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_document_create(uuid, text, text, text, integer, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pool_document_update(uuid, text, text, integer, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pool_document_replace(uuid, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pool_document_delete(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pool_public_document_path(_token text, _document_id uuid)
RETURNS TABLE(storage_path text, mime_type text, title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.storage_path, d.mime_type, d.title
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
REVOKE ALL ON FUNCTION public.pool_public_document_path(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pool_public_document_path(text, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pool_delete_summary(_pool_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_pool(_pool_id) THEN RAISE EXCEPTION 'Sem permissão para excluir este bolão.' USING ERRCODE = '42501'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'participants', (SELECT count(*) FROM public.pool_participants WHERE pool_id = _pool_id),
      'games', (SELECT count(*) FROM public.pool_games WHERE pool_id = _pool_id),
      'payments', (SELECT count(*) FROM public.pool_payments WHERE pool_id = _pool_id AND cancelled_at IS NULL),
      'documents', (SELECT count(*) FROM public.pool_documents WHERE pool_id = _pool_id AND deleted_at IS NULL),
      'distributions', (SELECT count(*) FROM public.pool_prize_distributions WHERE pool_id = _pool_id),
      'results', (SELECT count(*) FROM public.pool_games pg JOIN public.game_check_results gr ON gr.game_id = pg.game_id WHERE pg.pool_id = _pool_id)
    ) FROM public.pools WHERE id = _pool_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.pool_delete_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_delete_summary(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pool_delete_permanently(_pool_id uuid, _confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pool public.pools%ROWTYPE;
  _paths text[];
  _summary jsonb;
  _job_id uuid;
BEGIN
  IF _confirmation <> 'EXCLUIR' THEN RAISE EXCEPTION 'Digite EXCLUIR para confirmar.' USING ERRCODE = '22023'; END IF;
  IF NOT public.can_manage_pool(_pool_id) THEN RAISE EXCEPTION 'Sem permissão para excluir este bolão.' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _pool FROM public.pools WHERE id = _pool_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bolão não encontrado.' USING ERRCODE = 'P0002'; END IF;

  SELECT COALESCE(array_agg(path), '{}') INTO _paths
  FROM (
    SELECT storage_path AS path FROM public.pool_documents WHERE pool_id = _pool_id
    UNION
    SELECT v.storage_path FROM public.pool_document_versions v JOIN public.pool_documents d ON d.id = v.document_id WHERE d.pool_id = _pool_id
  ) paths;

  SELECT public.pool_delete_summary(_pool_id) INTO _summary;

  INSERT INTO public.audit_logs(user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'pool', _pool_id, 'pool_deleted', jsonb_build_object(
    'owner_id', _pool.owner_id,
    'operational_status', _pool.status,
    'archived', _pool.archived_at IS NOT NULL,
    'summary', _summary
  ));

  INSERT INTO public.pool_storage_cleanup_jobs(pool_id, requested_by, storage_paths)
  VALUES (_pool_id, auth.uid(), _paths)
  RETURNING id INTO _job_id;

  DELETE FROM public.pools WHERE id = _pool_id;

  RETURN jsonb_build_object('cleanupJobId', _job_id, 'storagePaths', _paths, 'summary', _summary);
END;
$$;
REVOKE ALL ON FUNCTION public.pool_delete_permanently(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_delete_permanently(uuid, text) TO authenticated, service_role;
REVOKE DELETE ON public.pools FROM authenticated;

CREATE INDEX pools_archived_at_idx ON public.pools (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX pool_documents_public_idx ON public.pool_documents (pool_id, sort_order, created_at) WHERE is_published AND deleted_at IS NULL;
CREATE INDEX pool_documents_active_idx ON public.pool_documents (pool_id, sort_order, created_at) WHERE deleted_at IS NULL;