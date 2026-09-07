CREATE OR REPLACE FUNCTION public.pool_calculate_distribution(_pool_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total numeric;
  _cents bigint;
  _quotas integer;
  _base bigint;
  _remainder bigint;
  _hash text;
  _current pool_prize_distributions%ROWTYPE;
  _version integer;
  _dist_id uuid;
  _row record;
  _count integer;
  _i integer := 0;
  _extra bigint;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador calcula o rateio.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_pool_id::text, 42));

  _total := public.pool_prize_total(_pool_id);
  SELECT COALESCE(SUM(quotas), 0), COUNT(*) INTO _quotas, _count FROM pool_participants
   WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share AND quotas > 0;

  IF _quotas <= 0 THEN
    RAISE EXCEPTION 'Não há cotas elegíveis para o rateio.' USING ERRCODE = '23514';
  END IF;

  SELECT md5(_total::text || ':' || _quotas::text || ':' || COALESCE(string_agg(id::text || ':' || quotas::text, ',' ORDER BY id), ''))
    INTO _hash
    FROM pool_participants
   WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share AND quotas > 0;

  SELECT * INTO _current FROM pool_prize_distributions
   WHERE pool_id = _pool_id ORDER BY version DESC LIMIT 1;

  IF _current.id IS NOT NULL AND _current.source_hash = _hash AND _current.status <> 'OUTDATED' THEN
    RETURN _current.id;
  END IF;

  _cents := round(_total * 100)::bigint;
  _base := _cents / _quotas;
  _remainder := _cents - (_base * _quotas);
  _version := COALESCE(_current.version, 0) + 1;

  UPDATE pool_prize_distributions SET status = 'OUTDATED'
   WHERE pool_id = _pool_id AND status = 'CALCULATED';

  INSERT INTO pool_prize_distributions (
    pool_id, version, total_prize, rateable_prize, total_eligible_quotas,
    value_per_quota, rounding_remainder, status, source_hash, calculated_by
  ) VALUES (
    _pool_id, _version, _total, _total, _quotas,
    _base / 100.0, _remainder / 100.0, 'CALCULATED', _hash, auth.uid()
  ) RETURNING id INTO _dist_id;

  -- A sobra pode superar o número de participantes: distribuímos um centavo
  -- por vez, dando voltas na mesma ordem determinística, até zerar.
  FOR _row IN
    SELECT id, quotas, payment_status FROM pool_participants
     WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share AND quotas > 0
     ORDER BY quotas DESC, name ASC, id ASC
  LOOP
    _extra := (_remainder / _count) + CASE WHEN _i < (_remainder % _count) THEN 1 ELSE 0 END;
    INSERT INTO pool_prize_participants (
      distribution_id, participant_id, eligible_quotas, share_amount,
      rounding_adjustment, payment_status_at_calc
    ) VALUES (
      _dist_id, _row.id, _row.quotas,
      ((_base * _row.quotas) + _extra) / 100.0,
      _extra / 100.0, _row.payment_status
    );
    _i := _i + 1;
  END LOOP;

  PERFORM public.log_pool_event(_pool_id, 'distribution_calculated',
    'Rateio calculado', jsonb_build_object('version', _version, 'total', _total, 'quotas', _quotas));
  RETURN _dist_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.pool_calculate_distribution(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_calculate_distribution(uuid) TO authenticated;