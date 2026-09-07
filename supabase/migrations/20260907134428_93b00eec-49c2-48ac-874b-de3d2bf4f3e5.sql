CREATE OR REPLACE FUNCTION public.pool_set_public(_pool_id uuid, _enabled boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE _token text;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera o link público.' USING ERRCODE = '42501';
  END IF;
  IF _enabled THEN
    _token := encode(extensions.gen_random_bytes(16), 'hex');
    UPDATE pools SET is_public = true, public_token = _token WHERE id = _pool_id;
    PERFORM public.log_pool_event(_pool_id, 'public_link_enabled', 'Link público ativado', NULL);
  ELSE
    UPDATE pools SET is_public = false, public_token = NULL WHERE id = _pool_id;
    PERFORM public.log_pool_event(_pool_id, 'public_link_revoked', 'Link público revogado', NULL);
    _token := NULL;
  END IF;
  RETURN _token;
END; $function$;