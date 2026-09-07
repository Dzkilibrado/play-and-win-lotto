-- 1. Fila de conferência: colunas de controle de concorrência
ALTER TABLE public.game_check_jobs
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- 2. Guarda de campos controlados pelo servidor em generated_games
CREATE OR REPLACE FUNCTION public.guard_generated_games_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _manual game_status[] := ARRAY['PLANNED','BET','RECEIPTED','AWAITING_DRAW','AWAITING_CHECK']::game_status[];
BEGIN
  -- Conferência oficial (apply_game_check / mark_games_awaiting_check) marca a transação.
  IF coalesce(current_setting('app.official_check', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.hits IS NOT NULL OR NEW.prize_amount IS NOT NULL THEN
      RAISE EXCEPTION 'Acertos e prêmio são definidos apenas pela conferência oficial.' USING ERRCODE = '42501';
    END IF;
    IF NOT (NEW.status = ANY(_manual)) THEN
      RAISE EXCEPTION 'Situação de resultado só pode ser gravada pela conferência oficial.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.hits IS DISTINCT FROM OLD.hits THEN
    RAISE EXCEPTION 'Acertos são definidos apenas pela conferência oficial.' USING ERRCODE = '42501';
  END IF;
  IF NEW.prize_amount IS DISTINCT FROM OLD.prize_amount THEN
    RAISE EXCEPTION 'Valor do prêmio é definido apenas pela conferência oficial.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = ANY(_manual)) THEN
      RAISE EXCEPTION 'Situação definida pela conferência oficial não pode ser alterada.' USING ERRCODE = '42501';
    END IF;
    IF NOT (NEW.status = ANY(_manual)) THEN
      RAISE EXCEPTION 'Situação de resultado só pode ser gravada pela conferência oficial.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.draw_id IS DISTINCT FROM OLD.draw_id AND OLD.draw_id IS NOT NULL THEN
    RAISE EXCEPTION 'Concurso conferido não pode ser trocado.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generated_games_guard ON public.generated_games;
CREATE TRIGGER generated_games_guard
BEFORE INSERT OR UPDATE ON public.generated_games
FOR EACH ROW EXECUTE FUNCTION public.guard_generated_games_fields();

-- 3. Marcação de transação oficial nas funções de conferência
CREATE OR REPLACE FUNCTION public.apply_game_check(_game_id uuid, _draw_id uuid, _payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _result_id uuid;
  _is_prized boolean := COALESCE((_payload->>'is_prized')::boolean, false);
  _status game_status;
BEGIN
  PERFORM set_config('app.official_check', 'on', true);
  PERFORM pg_advisory_xact_lock(hashtextextended(_game_id::text, 0));

  INSERT INTO game_check_results (
    game_id, draw_id, contest_number, hits, matched_numbers, is_prized,
    prize_tier_hits, prize_label, total_prize, amount_pending,
    calculation_version, source_updated_at, checked_at
  ) VALUES (
    _game_id,
    _draw_id,
    (_payload->>'contest_number')::integer,
    (_payload->>'hits')::integer,
    COALESCE((SELECT array_agg(value::int ORDER BY value::int)
              FROM jsonb_array_elements_text(COALESCE(_payload->'matched_numbers','[]'::jsonb)) AS value), '{}'),
    _is_prized,
    NULLIF(_payload->>'prize_tier_hits','')::integer,
    _payload->>'prize_label',
    NULLIF(_payload->>'total_prize','')::numeric,
    COALESCE((_payload->>'amount_pending')::boolean, false),
    COALESCE((_payload->>'calculation_version')::integer, 1),
    NULLIF(_payload->>'source_updated_at','')::timestamptz,
    now()
  )
  ON CONFLICT (game_id) DO UPDATE SET
    draw_id = EXCLUDED.draw_id,
    contest_number = EXCLUDED.contest_number,
    hits = EXCLUDED.hits,
    matched_numbers = EXCLUDED.matched_numbers,
    is_prized = EXCLUDED.is_prized,
    prize_tier_hits = EXCLUDED.prize_tier_hits,
    prize_label = EXCLUDED.prize_label,
    total_prize = EXCLUDED.total_prize,
    amount_pending = EXCLUDED.amount_pending,
    calculation_version = EXCLUDED.calculation_version,
    source_updated_at = EXCLUDED.source_updated_at,
    checked_at = now()
  RETURNING id INTO _result_id;

  DELETE FROM game_prize_breakdown WHERE check_result_id = _result_id;

  INSERT INTO game_prize_breakdown (
    check_result_id, draw_prize_id, tier, hits_required,
    winning_combinations, prize_per_combination, total_for_tier
  )
  SELECT _result_id,
         NULLIF(item->>'draw_prize_id','')::uuid,
         item->>'tier',
         (item->>'hits_required')::integer,
         (item->>'winning_combinations')::bigint,
         NULLIF(item->>'prize_per_combination','')::numeric,
         NULLIF(item->>'total_for_tier','')::numeric
  FROM jsonb_array_elements(COALESCE(_payload->'breakdown','[]'::jsonb)) AS item;

  _status := CASE WHEN _is_prized THEN 'PRIZED'::game_status ELSE 'NOT_PRIZED'::game_status END;

  UPDATE generated_games SET
    status = _status,
    hits = (_payload->>'hits')::integer,
    prize_amount = NULLIF(_payload->>'total_prize','')::numeric,
    draw_id = _draw_id
  WHERE id = _game_id;

  DELETE FROM game_check_errors WHERE game_id = _game_id AND draw_id = _draw_id AND resolved_at IS NULL;

  RETURN _result_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_games_awaiting_check(_draw_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _count integer;
BEGIN
  PERFORM set_config('app.official_check', 'on', true);
  WITH d AS (SELECT lottery_id, contest_number FROM lottery_draws WHERE id = _draw_id)
  UPDATE generated_games g SET status = 'AWAITING_CHECK', draw_id = _draw_id
  FROM d
  WHERE g.lottery_id = d.lottery_id
    AND g.contest_number = d.contest_number
    AND g.status IN ('BET','RECEIPTED','AWAITING_DRAW');
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$function$;

-- 4. Transições manuais do usuário por função controlada
CREATE OR REPLACE FUNCTION public.set_manual_game_status(_game_id uuid, _status game_status)
RETURNS game_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _manual game_status[] := ARRAY['PLANNED','BET','RECEIPTED','AWAITING_DRAW','AWAITING_CHECK']::game_status[];
  _old game_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE = '42501';
  END IF;
  IF NOT (_status = ANY(_manual)) THEN
    RAISE EXCEPTION 'Situação de resultado só pode ser gravada pela conferência oficial.' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO _old FROM generated_games
   WHERE id = _game_id AND user_id = auth.uid()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jogo não encontrado.' USING ERRCODE = '42501';
  END IF;
  IF NOT (_old = ANY(_manual)) THEN
    RAISE EXCEPTION 'Este jogo já foi conferido: a situação é definida pelo resultado oficial.' USING ERRCODE = '42501';
  END IF;

  UPDATE generated_games SET status = _status WHERE id = _game_id;
  RETURN _status;
END;
$$;

REVOKE ALL ON FUNCTION public.set_manual_game_status(uuid, game_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_manual_game_status(uuid, game_status) TO authenticated;

-- 5. Reserva atômica da fila de conferência
CREATE OR REPLACE FUNCTION public.claim_check_job(_job_id uuid, _stale_after interval DEFAULT '00:05:00'::interval)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _claimed boolean;
BEGIN
  UPDATE game_check_jobs SET
    status = 'running',
    started_at = COALESCE(started_at, now()),
    locked_at = now(),
    last_activity_at = now()
  WHERE id = _job_id
    AND (
      status = 'pending'
      OR (status = 'running' AND (last_activity_at IS NULL OR last_activity_at < now() - _stale_after))
    )
  RETURNING true INTO _claimed;
  RETURN COALESCE(_claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_check_job(uuid, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_check_job(uuid, interval) TO service_role;
