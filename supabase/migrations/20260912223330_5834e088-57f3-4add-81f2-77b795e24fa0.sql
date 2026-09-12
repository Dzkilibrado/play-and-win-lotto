CREATE OR REPLACE FUNCTION public.profile_onboarding_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH current_documents AS (
    SELECT id
    FROM public.legal_document_versions
    WHERE is_active = true
      AND published_at <= now()
      AND requires_reacceptance = true
  ), profile_state AS (
    SELECT
      p.display_name IS NOT NULL
        AND char_length(btrim(p.display_name)) >= 3
        AND p.birth_date IS NOT NULL
        AND p.birth_date <= (current_date - interval '18 years')::date
        AND p.phone ~ '^\+55[1-9][0-9]{9,10}$' AS identity_complete
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
  SELECT jsonb_build_object(
    'identityComplete', COALESCE((SELECT identity_complete FROM profile_state), false),
    'legalComplete', NOT EXISTS (
      SELECT 1
      FROM current_documents d
      WHERE NOT EXISTS (
        SELECT 1 FROM public.legal_acceptances a
        WHERE a.user_id = auth.uid() AND a.document_version_id = d.id
      )
    ),
    'complete', COALESCE((SELECT identity_complete FROM profile_state), false)
      AND NOT EXISTS (
        SELECT 1
        FROM current_documents d
        WHERE NOT EXISTS (
          SELECT 1 FROM public.legal_acceptances a
          WHERE a.user_id = auth.uid() AND a.document_version_id = d.id
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.profile_onboarding_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_onboarding_status() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complete_profile_onboarding(
  _display_name text,
  _birth_date date,
  _phone text,
  _accepted_document_ids uuid[]
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _profile public.profiles;
  _required_count integer;
  _accepted_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  IF _display_name IS NULL OR char_length(btrim(_display_name)) < 3 OR char_length(btrim(_display_name)) > 120 THEN
    RAISE EXCEPTION 'Informe seu nome completo';
  END IF;
  IF _birth_date IS NULL OR _birth_date > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION 'O Gestor da Sorte é destinado a usuários maiores de 18 anos.';
  END IF;
  IF _phone IS NULL OR btrim(_phone) !~ '^\+55[1-9][0-9]{9,10}$' THEN
    RAISE EXCEPTION 'Informe um telefone brasileiro válido';
  END IF;

  SELECT count(*) INTO _required_count
  FROM public.legal_document_versions
  WHERE is_active = true AND published_at <= now() AND requires_reacceptance = true;

  SELECT count(*) INTO _accepted_count
  FROM public.legal_document_versions
  WHERE id = ANY(COALESCE(_accepted_document_ids, ARRAY[]::uuid[]))
    AND is_active = true AND published_at <= now() AND requires_reacceptance = true;

  IF _accepted_count <> _required_count THEN
    RAISE EXCEPTION 'É necessário aceitar os Termos de Uso e a Política de Privacidade vigentes.';
  END IF;

  UPDATE public.profiles
  SET display_name = btrim(_display_name),
      birth_date = _birth_date,
      phone = btrim(_phone),
      updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO _profile;

  IF _profile.id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  INSERT INTO public.legal_acceptances (user_id, document_version_id)
  SELECT auth.uid(), id
  FROM public.legal_document_versions
  WHERE id = ANY(COALESCE(_accepted_document_ids, ARRAY[]::uuid[]))
    AND is_active = true AND published_at <= now()
  ON CONFLICT (user_id, document_version_id) DO NOTHING;

  RETURN _profile;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_profile_onboarding(text, date, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_profile_onboarding(text, date, text, uuid[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;