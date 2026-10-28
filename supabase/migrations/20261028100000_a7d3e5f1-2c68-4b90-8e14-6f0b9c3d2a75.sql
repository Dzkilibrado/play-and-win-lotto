-- Exclusão de conta pelo ADMIN (contas de teste ou pedido do titular).
-- Valida as proteções, grava a auditoria (sem dados pessoais) e devolve o resumo do que será apagado.
-- A remoção da conta em si é feita pelo servidor (auth.admin.deleteUser), logo depois.
CREATE OR REPLACE FUNCTION public.admin_prepare_user_deletion(
  _actor uuid, _target uuid, _reason text, _details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_owner uuid;
  v_games integer;
  v_pools integer;
  v_shared_pools integer;
BEGIN
  IF NOT public.has_role(_actor, 'ADMIN') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR _reason NOT IN ('TEST_ACCOUNT', 'OWNER_REQUEST', 'OTHER') THEN
    RAISE EXCEPTION 'Informe o motivo da exclusão.' USING ERRCODE = '22023';
  END IF;
  IF _reason = 'OTHER' AND coalesce(btrim(_details), '') = '' THEN
    RAISE EXCEPTION 'Descreva o motivo.' USING ERRCODE = '22023';
  END IF;
  IF _actor = _target THEN
    RAISE EXCEPTION 'Você não pode excluir a sua própria conta.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target) THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = '22023';
  END IF;

  SELECT system_owner_user_id INTO v_owner FROM public.system_settings WHERE singleton = true;
  IF v_owner = _target THEN
    RAISE EXCEPTION 'O responsável principal não pode ser excluído.' USING ERRCODE = '22023';
  END IF;
  IF public.has_role(_target, 'ADMIN') OR public.has_role(_target, 'SUPORTE') THEN
    RAISE EXCEPTION 'Altere o tipo de acesso para Usuário antes de excluir esta conta.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_games FROM public.generated_games WHERE user_id = _target;
  SELECT count(*) INTO v_pools FROM public.pools WHERE owner_id = _target;
  SELECT count(*) INTO v_shared_pools
  FROM public.pools p
  WHERE p.owner_id = _target
    AND (SELECT count(*) FROM public.pool_participants pp WHERE pp.pool_id = p.id) > 1;
  IF v_shared_pools > 0 THEN
    RAISE EXCEPTION 'Esta conta é dona de bolão com participantes. Exclua ou transfira o bolão antes, ou apenas bloqueie o acesso.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_logs (user_id, entity_type, entity_id, action, metadata)
  VALUES (_actor, 'USER_ACCOUNT', _target, 'USER_DELETED',
    jsonb_strip_nulls(jsonb_build_object('reason', _reason, 'reason_details', nullif(btrim(_details), ''), 'games', v_games, 'pools', v_pools)));

  RETURN jsonb_build_object('games', v_games, 'pools', v_pools);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_prepare_user_deletion(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_user_deletion(uuid, uuid, text, text) TO service_role;
