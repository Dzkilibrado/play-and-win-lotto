ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

CREATE OR REPLACE FUNCTION public.validate_profile_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS NOT NULL THEN
    NEW.display_name := NULLIF(btrim(NEW.display_name), '');
    IF NEW.display_name IS NOT NULL AND (char_length(NEW.display_name) < 3 OR char_length(NEW.display_name) > 120) THEN
      RAISE EXCEPTION 'Nome completo inválido';
    END IF;
  END IF;

  IF NEW.phone IS NOT NULL THEN
    NEW.phone := NULLIF(btrim(NEW.phone), '');
    IF NEW.phone IS NOT NULL AND NEW.phone !~ '^\+55[1-9][0-9]{9,10}$' THEN
      RAISE EXCEPTION 'Telefone brasileiro inválido';
    END IF;
  END IF;

  IF NEW.birth_date IS NOT NULL AND NEW.birth_date > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION 'O Gestor da Sorte é destinado a usuários maiores de 18 anos.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_identity ON public.profiles;
CREATE TRIGGER profiles_validate_identity
BEFORE INSERT OR UPDATE OF display_name, phone, birth_date ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_identity();

CREATE TABLE public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('TERMS', 'PRIVACY')),
  version text NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  published_at timestamptz NOT NULL DEFAULT now(),
  requires_reacceptance boolean NOT NULL DEFAULT true,
  is_preliminary boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, version)
);
GRANT SELECT ON public.legal_document_versions TO anon, authenticated;
GRANT ALL ON public.legal_document_versions TO service_role;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published legal versions are public"
ON public.legal_document_versions FOR SELECT TO anon, authenticated
USING (is_active = true AND published_at <= now());

CREATE UNIQUE INDEX legal_document_one_active_per_type
ON public.legal_document_versions (document_type)
WHERE is_active = true;

CREATE TABLE public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_version_id uuid NOT NULL REFERENCES public.legal_document_versions(id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_version_id)
);
GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own legal acceptances read"
ON public.legal_acceptances FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "own legal acceptances insert"
ON public.legal_acceptances FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

INSERT INTO public.legal_document_versions
  (document_type, version, title, requires_reacceptance, is_preliminary, is_active)
VALUES
  ('TERMS', '1.0', 'Termos de Uso', true, true, true),
  ('PRIVACY', '1.0', 'Política de Privacidade', true, true, true)
ON CONFLICT (document_type, version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.profile_onboarding_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
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
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _birth_date date;
  _phone text;
BEGIN
  BEGIN
    _birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::date;
  EXCEPTION WHEN invalid_datetime_format THEN
    RAISE EXCEPTION 'Data de nascimento inválida';
  END;
  _phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');

  INSERT INTO public.profiles (id, display_name, birth_date, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    _birth_date,
    _phone
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'USER') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;