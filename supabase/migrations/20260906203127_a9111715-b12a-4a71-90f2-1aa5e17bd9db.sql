
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
    hashtextextended(_lottery_id::text || ':' || _contest_number::text, 0)
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

  INSERT INTO draw_numbers (draw_id, number, position)
  SELECT _draw_id, (item->>'number')::int, (item->>'position')::int
  FROM jsonb_array_elements(_numbers) AS item
  ON CONFLICT (draw_id, number) DO UPDATE SET position = EXCLUDED.position;

  DELETE FROM draw_numbers dn
  WHERE dn.draw_id = _draw_id
    AND dn.number NOT IN (
      SELECT (item->>'number')::int FROM jsonb_array_elements(_numbers) AS item
    );

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
