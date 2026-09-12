CREATE OR REPLACE FUNCTION public.record_password_changed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'auth', auth.uid(), 'password_changed', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.record_password_changed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_password_changed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_password_changed() TO service_role;

COMMENT ON FUNCTION public.record_password_changed() IS 'Registra somente o evento de alteração da própria senha, sem receber ou armazenar credenciais.';