CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _birth_date date;
  _phone text;
  _provider text;
  _accepted_document_ids uuid[];
  _required_count integer;
  _accepted_count integer;
BEGIN
  _provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  BEGIN
    _birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::date;
  EXCEPTION WHEN invalid_datetime_format THEN
    RAISE EXCEPTION 'Data de nascimento inválida';
  END;
  _phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');

  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO _accepted_document_ids
  FROM jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data->'accepted_document_ids', '[]'::jsonb));

  IF _provider = 'email' THEN
    IF _birth_date IS NULL OR _birth_date > (current_date - interval '18 years')::date THEN
      RAISE EXCEPTION 'O Gestor da Sorte é destinado a usuários maiores de 18 anos.';
    END IF;
    IF _phone IS NULL OR _phone !~ '^\+55[1-9][0-9]{9,10}$' THEN
      RAISE EXCEPTION 'Informe um telefone brasileiro válido';
    END IF;

    SELECT count(*) INTO _required_count
    FROM public.legal_document_versions
    WHERE is_active = true AND published_at <= now() AND requires_reacceptance = true;

    SELECT count(*) INTO _accepted_count
    FROM public.legal_document_versions
    WHERE id = ANY(_accepted_document_ids)
      AND is_active = true AND published_at <= now() AND requires_reacceptance = true;

    IF _accepted_count <> _required_count THEN
      RAISE EXCEPTION 'É necessário aceitar os Termos de Uso e a Política de Privacidade vigentes.';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, birth_date, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    _birth_date,
    _phone
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'USER') ON CONFLICT DO NOTHING;

  INSERT INTO public.legal_acceptances (user_id, document_version_id)
  SELECT NEW.id, id
  FROM public.legal_document_versions
  WHERE id = ANY(_accepted_document_ids)
    AND is_active = true AND published_at <= now()
  ON CONFLICT (user_id, document_version_id) DO NOTHING;

  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;