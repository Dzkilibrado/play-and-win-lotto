ALTER TABLE public.pools ALTER COLUMN total_quotas DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.pool_update_details(_pool_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pool pools%ROWTYPE;
  _structural boolean;
  _has_games boolean;
  _taken integer;
  _new_total integer;
  _new_quota numeric;
  _p record;
BEGIN
  SELECT * INTO _pool FROM pools WHERE id = _pool_id FOR UPDATE;
  IF _pool.id IS NULL THEN
    RAISE EXCEPTION 'Bolão não encontrado.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador edita o bolão.' USING ERRCODE = '42501';
  END IF;

  _structural := _pool.status IN ('FORMING','OPEN','CLOSED');
  SELECT EXISTS (SELECT 1 FROM pool_games WHERE pool_id = _pool_id) INTO _has_games;
  SELECT COALESCE(SUM(quotas), 0) INTO _taken
    FROM pool_participants WHERE pool_id = _pool_id AND status = 'ACTIVE';

  IF _patch ? 'name' THEN
    IF COALESCE(btrim(_patch->>'name'), '') = '' THEN
      RAISE EXCEPTION 'Informe o nome do bolão.' USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET name = btrim(_patch->>'name') WHERE id = _pool_id;
  END IF;

  IF _patch ? 'notes' THEN
    UPDATE pools SET notes = NULLIF(_patch->>'notes','') WHERE id = _pool_id;
  END IF;

  IF NOT _structural THEN
    IF _patch ?| ARRAY['lottery_id','contest_number','draw_date','quota_value','total_quotas','payment_deadline'] THEN
      RAISE EXCEPTION 'Nesta situação do bolão só é possível ajustar o nome e as observações.' USING ERRCODE = '23514';
    END IF;
    PERFORM public.log_pool_event(_pool_id, 'pool_updated', 'Dados do bolão atualizados', _patch);
    RETURN;
  END IF;

  IF _patch ? 'lottery_id' AND (_patch->>'lottery_id')::uuid IS DISTINCT FROM _pool.lottery_id THEN
    IF _has_games THEN
      RAISE EXCEPTION 'Remova os jogos antes de trocar a modalidade.' USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET lottery_id = (_patch->>'lottery_id')::uuid, contest_id = NULL WHERE id = _pool_id;
  END IF;

  IF _patch ? 'contest_number' THEN
    IF _has_games AND NULLIF(_patch->>'contest_number','')::integer
       IS DISTINCT FROM COALESCE(_pool.contest_number, _pool.contest_number_planned) THEN
      RAISE EXCEPTION 'Remova os jogos antes de trocar o concurso.' USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET
      contest_number = NULLIF(_patch->>'contest_number','')::integer,
      contest_number_planned = NULLIF(_patch->>'contest_number','')::integer,
      contest_id = NULL
    WHERE id = _pool_id;
  END IF;

  IF _patch ? 'draw_date' THEN
    UPDATE pools SET
      draw_date = NULLIF(_patch->>'draw_date','')::date,
      draw_date_planned = NULLIF(_patch->>'draw_date','')::date
    WHERE id = _pool_id;
  END IF;

  IF _patch ? 'payment_deadline' THEN
    UPDATE pools SET payment_deadline = NULLIF(_patch->>'payment_deadline','')::date WHERE id = _pool_id;
  END IF;

  IF _patch ? 'total_quotas' THEN
    _new_total := NULLIF(_patch->>'total_quotas','')::integer;
    IF _new_total IS NOT NULL AND _new_total < 1 THEN
      RAISE EXCEPTION 'O total de cotas deve ser maior que zero ou ficar em branco.' USING ERRCODE = '23514';
    END IF;
    IF _new_total IS NOT NULL AND _new_total < _taken THEN
      RAISE EXCEPTION 'O bolão já possui % cotas atribuídas.', _taken USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET total_quotas = _new_total WHERE id = _pool_id;
  END IF;

  IF _patch ? 'quota_value' THEN
    _new_quota := NULLIF(_patch->>'quota_value','')::numeric;
    IF _new_quota IS NULL OR _new_quota <= 0 THEN
      RAISE EXCEPTION 'O valor da cota deve ser maior que zero.' USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET quota_value = _new_quota WHERE id = _pool_id;
    IF _new_quota IS DISTINCT FROM _pool.quota_value THEN
      FOR _p IN SELECT id, quotas, amount_adjustment FROM pool_participants WHERE pool_id = _pool_id LOOP
        UPDATE pool_participants
           SET amount_due = GREATEST(_new_quota * GREATEST(COALESCE(_p.quotas,0),0) + COALESCE(_p.amount_adjustment,0), 0)
         WHERE id = _p.id;
        PERFORM public.recalc_participant_payment(_p.id);
      END LOOP;
      UPDATE pool_prize_distributions SET status = 'OUTDATED'
       WHERE pool_id = _pool_id AND status = 'CALCULATED';
    END IF;
  END IF;

  PERFORM public.log_pool_event(_pool_id, 'pool_updated', 'Dados do bolão atualizados', _patch);
END;
$$;

REVOKE ALL ON FUNCTION public.pool_update_details(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_update_details(uuid, jsonb) TO authenticated;