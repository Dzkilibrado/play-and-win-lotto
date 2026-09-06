
-- 1) Nullability: distinguir 0 (oficial) de NULL (não informado)
ALTER TABLE public.draw_prizes ALTER COLUMN winners DROP NOT NULL;
ALTER TABLE public.draw_prizes ALTER COLUMN prize_per_winner DROP NOT NULL;

-- 2) CHECK constraints (validados: nenhum registro atual viola)
ALTER TABLE public.lottery_draws ADD CONSTRAINT lottery_draws_contest_positive CHECK (contest_number > 0);
ALTER TABLE public.draw_numbers ADD CONSTRAINT draw_numbers_number_positive CHECK (number > 0);
ALTER TABLE public.draw_numbers ADD CONSTRAINT draw_numbers_position_positive CHECK (position > 0);
ALTER TABLE public.draw_prizes ADD CONSTRAINT draw_prizes_hits_positive CHECK (hits > 0);
ALTER TABLE public.draw_prizes ADD CONSTRAINT draw_prizes_winners_nonneg CHECK (winners IS NULL OR winners >= 0);
ALTER TABLE public.draw_prizes ADD CONSTRAINT draw_prizes_prize_nonneg CHECK (prize_per_winner IS NULL OR prize_per_winner >= 0);
ALTER TABLE public.lottery_prices ADD CONSTRAINT lottery_prices_domain CHECK (numbers_selected > 0 AND combination_count > 0 AND price > 0);
ALTER TABLE public.pools ADD CONSTRAINT pools_quotas_nonneg CHECK (total_quotas >= 0 AND (quota_value IS NULL OR quota_value >= 0));
ALTER TABLE public.pool_participants ADD CONSTRAINT pool_participants_nonneg CHECK (quotas >= 0 AND (amount_due IS NULL OR amount_due >= 0));
ALTER TABLE public.pool_payments ADD CONSTRAINT pool_payments_amount_nonneg CHECK (amount >= 0);

-- 3) Somente um preço ativo por (lottery_id, numbers_selected)
CREATE UNIQUE INDEX IF NOT EXISTS lottery_prices_one_active
  ON public.lottery_prices (lottery_id, numbers_selected)
  WHERE is_active;

-- 4) Controle de jobs interrompidos
ALTER TABLE public.lottery_sync_jobs ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.lottery_sync_jobs ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
CREATE INDEX IF NOT EXISTS lottery_sync_jobs_active_idx
  ON public.lottery_sync_jobs (status, created_at)
  WHERE status IN ('pending','running');

-- 5) Persistência atômica de um concurso (concurso + dezenas + faixas)
CREATE OR REPLACE FUNCTION public.persist_official_draw(
  _lottery_id uuid,
  _contest_number integer,
  _draw jsonb,
  _numbers jsonb,
  _prizes jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _draw_id uuid;
  _existing_imported timestamptz;
  _now timestamptz := now();
  _outcome text;
BEGIN
  IF _contest_number IS NULL OR _contest_number <= 0 THEN
    RAISE EXCEPTION 'contest_number inválido: %', _contest_number;
  END IF;
  IF _numbers IS NULL OR jsonb_array_length(_numbers) = 0 THEN
    RAISE EXCEPTION 'concurso % sem dezenas: persistência recusada', _contest_number;
  END IF;

  -- Lock transacional por (lottery_id, contest_number); liberado no fim da transação.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(_lottery_id::text, 0),
    _contest_number
  );

  SELECT id, imported_at INTO _draw_id, _existing_imported
  FROM lottery_draws
  WHERE lottery_id = _lottery_id AND contest_number = _contest_number
  FOR UPDATE;

  IF _draw_id IS NULL THEN
    INSERT INTO lottery_draws (
      lottery_id, contest_number, draw_date, draw_location, is_accumulated,
      main_prize, estimated_next_prize, next_contest_number, next_draw_date,
      revenue, source, source_updated_at, imported_at, verified_at
    ) VALUES (
      _lottery_id,
      _contest_number,
      NULLIF(_draw->>'draw_date','')::date,
      _draw->>'draw_location',
      (_draw->>'is_accumulated')::boolean,
      NULLIF(_draw->>'main_prize','')::numeric,
      NULLIF(_draw->>'estimated_next_prize','')::numeric,
      NULLIF(_draw->>'next_contest_number','')::integer,
      NULLIF(_draw->>'next_draw_date','')::date,
      NULLIF(_draw->>'revenue','')::numeric,
      _draw->>'source',
      _now, _now, _now
    )
    RETURNING id INTO _draw_id;
    _outcome := 'inserted';
  ELSE
    UPDATE lottery_draws SET
      draw_date = NULLIF(_draw->>'draw_date','')::date,
      draw_location = _draw->>'draw_location',
      is_accumulated = (_draw->>'is_accumulated')::boolean,
      main_prize = NULLIF(_draw->>'main_prize','')::numeric,
      estimated_next_prize = NULLIF(_draw->>'estimated_next_prize','')::numeric,
      next_contest_number = NULLIF(_draw->>'next_contest_number','')::integer,
      next_draw_date = NULLIF(_draw->>'next_draw_date','')::date,
      revenue = NULLIF(_draw->>'revenue','')::numeric,
      source = _draw->>'source',
      source_updated_at = _now,
      imported_at = COALESCE(_existing_imported, _now),
      verified_at = _now
    WHERE id = _draw_id;
    _outcome := 'updated';
  END IF;

  -- Dezenas: upsert + remoção do que não pertence mais ao resultado validado.
  INSERT INTO draw_numbers (draw_id, number, position)
  SELECT _draw_id, (item->>'number')::int, (item->>'position')::int
  FROM jsonb_array_elements(_numbers) AS item
  ON CONFLICT (draw_id, number) DO UPDATE SET position = EXCLUDED.position;

  DELETE FROM draw_numbers dn
  WHERE dn.draw_id = _draw_id
    AND dn.number NOT IN (
      SELECT (item->>'number')::int FROM jsonb_array_elements(_numbers) AS item
    );

  -- Faixas: só substituídas quando a fonte devolveu premiação.
  IF _prizes IS NOT NULL AND jsonb_array_length(_prizes) > 0 THEN
    INSERT INTO draw_prizes (draw_id, tier, hits, winners, prize_per_winner)
    SELECT _draw_id,
           item->>'tier',
           (item->>'hits')::int,
           NULLIF(item->>'winners','')::bigint,
           NULLIF(item->>'prize_per_winner','')::numeric
    FROM jsonb_array_elements(_prizes) AS item
    ON CONFLICT (draw_id, hits) DO UPDATE SET
      tier = EXCLUDED.tier,
      winners = EXCLUDED.winners,
      prize_per_winner = EXCLUDED.prize_per_winner;

    DELETE FROM draw_prizes dp
    WHERE dp.draw_id = _draw_id
      AND dp.hits NOT IN (
        SELECT (item->>'hits')::int FROM jsonb_array_elements(_prizes) AS item
      );
  END IF;

  RETURN _outcome;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb) TO service_role;

-- 6) Reserva atômica de lote de um job (compare-and-swap + RETURNING)
CREATE OR REPLACE FUNCTION public.claim_sync_job_batch(
  _job_id uuid,
  _batch_size integer,
  _stale_after interval DEFAULT interval '5 minutes'
) RETURNS TABLE (job_id uuid, lottery_id uuid, claim_start integer, claim_end integer, is_final boolean, resumed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job lottery_sync_jobs%ROWTYPE;
  _start integer;
  _end integer;
  _was_running boolean;
BEGIN
  SELECT * INTO _job FROM lottery_sync_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF _job.status IN ('completed','completed_with_errors','failed') THEN RETURN; END IF;

  -- Outro processo detém o job e continua ativo: sai limpo.
  IF _job.status = 'running'
     AND _job.last_activity_at IS NOT NULL
     AND _job.last_activity_at > now() - _stale_after THEN
    RETURN;
  END IF;

  _was_running := (_job.status = 'running');
  _start := COALESCE(_job.current_contest, _job.start_contest, 1);
  _end := LEAST(COALESCE(_job.end_contest, _start), _start + GREATEST(_batch_size, 1) - 1);
  IF _start > COALESCE(_job.end_contest, _start) THEN
    UPDATE lottery_sync_jobs
      SET status = CASE WHEN failed > 0 THEN 'completed_with_errors'::sync_job_status ELSE 'completed'::sync_job_status END,
          finished_at = now(), locked_at = NULL, last_activity_at = now()
      WHERE id = _job_id;
    RETURN;
  END IF;

  -- Reserva a faixa imediatamente: ninguém mais processa esses concursos.
  UPDATE lottery_sync_jobs
    SET status = 'running',
        started_at = COALESCE(started_at, now()),
        current_contest = _end + 1,
        locked_at = now(),
        last_activity_at = now()
    WHERE id = _job_id;

  RETURN QUERY SELECT _job_id, _job.lottery_id, _start, _end,
                      (_end >= COALESCE(_job.end_contest, _end)), _was_running;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_sync_job_batch(uuid, integer, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sync_job_batch(uuid, integer, interval) TO service_role;

-- 7) Encerramento do lote: contadores incrementais (sem lost update)
CREATE OR REPLACE FUNCTION public.complete_sync_job_batch(
  _job_id uuid,
  _processed integer,
  _inserted integer,
  _updated integer,
  _failed integer,
  _is_final boolean,
  _last_error text DEFAULT NULL
) RETURNS lottery_sync_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row lottery_sync_jobs%ROWTYPE;
BEGIN
  UPDATE lottery_sync_jobs SET
    processed = processed + COALESCE(_processed,0),
    inserted = inserted + COALESCE(_inserted,0),
    updated = updated + COALESCE(_updated,0),
    failed = failed + COALESCE(_failed,0),
    last_error = COALESCE(_last_error, last_error),
    last_activity_at = now(),
    locked_at = CASE WHEN _is_final THEN NULL ELSE locked_at END,
    finished_at = CASE WHEN _is_final THEN now() ELSE NULL END,
    status = CASE
      WHEN _is_final AND (failed + COALESCE(_failed,0)) > 0 THEN 'completed_with_errors'::sync_job_status
      WHEN _is_final THEN 'completed'::sync_job_status
      ELSE 'running'::sync_job_status END
  WHERE id = _job_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_sync_job_batch(uuid, integer, integer, integer, integer, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sync_job_batch(uuid, integer, integer, integer, integer, boolean, text) TO service_role;
