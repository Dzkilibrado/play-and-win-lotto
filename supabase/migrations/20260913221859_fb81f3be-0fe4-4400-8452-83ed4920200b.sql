CREATE TABLE public.lottery_draw_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  contest_number integer NOT NULL,
  previous_snapshot jsonb NOT NULL,
  new_snapshot jsonb NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lottery_draw_revisions TO authenticated;
GRANT ALL ON public.lottery_draw_revisions TO service_role;
ALTER TABLE public.lottery_draw_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draw revisions admin read" ON public.lottery_draw_revisions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE INDEX lottery_draw_revisions_recent_idx ON public.lottery_draw_revisions (detected_at DESC);
CREATE INDEX lottery_draw_revisions_draw_idx ON public.lottery_draw_revisions (draw_id, detected_at DESC);

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
  _previous jsonb;
  _incoming jsonb;
BEGIN
  IF _contest_number IS NULL OR _contest_number <= 0 THEN
    RAISE EXCEPTION 'contest_number inválido: %', _contest_number;
  END IF;
  IF _numbers IS NULL OR jsonb_array_length(_numbers) = 0 THEN
    RAISE EXCEPTION 'concurso % sem dezenas: persistência recusada', _contest_number;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_lottery_id::text || ':' || _contest_number::text, 0));

  SELECT id, imported_at INTO _draw_id, _existing_imported
  FROM public.lottery_draws
  WHERE lottery_id = _lottery_id AND contest_number = _contest_number
  FOR UPDATE;

  _incoming := jsonb_build_object(
    'draw', jsonb_build_object(
      'draw_date', NULLIF(_draw->>'draw_date',''),
      'draw_location', NULLIF(_draw->>'draw_location',''),
      'is_accumulated', NULLIF(_draw->>'is_accumulated',''),
      'main_prize', NULLIF(_draw->>'main_prize',''),
      'estimated_next_prize', NULLIF(_draw->>'estimated_next_prize',''),
      'next_contest_number', NULLIF(_draw->>'next_contest_number',''),
      'next_draw_date', NULLIF(_draw->>'next_draw_date',''),
      'revenue', NULLIF(_draw->>'revenue',''),
      'source', NULLIF(_draw->>'source','')
    ),
    'numbers', COALESCE((SELECT jsonb_agg(jsonb_build_object('number', (item->>'number')::int, 'position', (item->>'position')::int) ORDER BY (item->>'position')::int) FROM jsonb_array_elements(_numbers) item), '[]'::jsonb),
    'prizes', COALESCE((SELECT jsonb_agg(jsonb_build_object('tier', item->>'tier', 'hits', (item->>'hits')::int, 'winners', NULLIF(item->>'winners','')::bigint, 'prize_per_winner', NULLIF(item->>'prize_per_winner','')::numeric) ORDER BY (item->>'hits')::int) FROM jsonb_array_elements(COALESCE(_prizes, '[]'::jsonb)) item), '[]'::jsonb)
  );

  IF _draw_id IS NULL THEN
    INSERT INTO public.lottery_draws (
      lottery_id, contest_number, draw_date, draw_location, is_accumulated,
      main_prize, estimated_next_prize, next_contest_number, next_draw_date,
      revenue, source, source_updated_at, imported_at, verified_at
    ) VALUES (
      _lottery_id, _contest_number, NULLIF(_draw->>'draw_date','')::date,
      _draw->>'draw_location', NULLIF(_draw->>'is_accumulated','')::boolean,
      NULLIF(_draw->>'main_prize','')::numeric, NULLIF(_draw->>'estimated_next_prize','')::numeric,
      NULLIF(_draw->>'next_contest_number','')::integer, NULLIF(_draw->>'next_draw_date','')::date,
      NULLIF(_draw->>'revenue','')::numeric, _draw->>'source', _now, _now, _now
    ) RETURNING id INTO _draw_id;
    _outcome := 'inserted';
  ELSE
    SELECT jsonb_build_object(
      'draw', jsonb_build_object(
        'draw_date', d.draw_date::text, 'draw_location', d.draw_location,
        'is_accumulated', d.is_accumulated::text, 'main_prize', d.main_prize::text,
        'estimated_next_prize', d.estimated_next_prize::text,
        'next_contest_number', d.next_contest_number::text,
        'next_draw_date', d.next_draw_date::text, 'revenue', d.revenue::text, 'source', d.source
      ),
      'numbers', COALESCE((SELECT jsonb_agg(jsonb_build_object('number', n.number, 'position', n.position) ORDER BY n.position) FROM public.draw_numbers n WHERE n.draw_id = d.id), '[]'::jsonb),
      'prizes', COALESCE((SELECT jsonb_agg(jsonb_build_object('tier', p.tier, 'hits', p.hits, 'winners', p.winners, 'prize_per_winner', p.prize_per_winner) ORDER BY p.hits) FROM public.draw_prizes p WHERE p.draw_id = d.id), '[]'::jsonb)
    ) INTO _previous
    FROM public.lottery_draws d WHERE d.id = _draw_id;

    IF _previous = _incoming THEN
      UPDATE public.lottery_draws SET verified_at = _now WHERE id = _draw_id;
      RETURN 'unchanged';
    END IF;

    INSERT INTO public.lottery_draw_revisions (draw_id, lottery_id, contest_number, previous_snapshot, new_snapshot)
    VALUES (_draw_id, _lottery_id, _contest_number, _previous, _incoming);

    UPDATE public.lottery_draws SET
      draw_date = NULLIF(_draw->>'draw_date','')::date,
      draw_location = _draw->>'draw_location',
      is_accumulated = NULLIF(_draw->>'is_accumulated','')::boolean,
      main_prize = NULLIF(_draw->>'main_prize','')::numeric,
      estimated_next_prize = NULLIF(_draw->>'estimated_next_prize','')::numeric,
      next_contest_number = NULLIF(_draw->>'next_contest_number','')::integer,
      next_draw_date = NULLIF(_draw->>'next_draw_date','')::date,
      revenue = NULLIF(_draw->>'revenue','')::numeric,
      source = _draw->>'source', source_updated_at = _now,
      imported_at = COALESCE(_existing_imported, _now), verified_at = _now
    WHERE id = _draw_id;
    _outcome := 'updated';
  END IF;

  INSERT INTO public.draw_numbers (draw_id, number, position)
  SELECT _draw_id, (item->>'number')::int, (item->>'position')::int
  FROM jsonb_array_elements(_numbers) item
  ON CONFLICT (draw_id, number) DO UPDATE SET position = EXCLUDED.position;
  DELETE FROM public.draw_numbers dn WHERE dn.draw_id = _draw_id
    AND dn.number NOT IN (SELECT (item->>'number')::int FROM jsonb_array_elements(_numbers) item);

  IF _prizes IS NOT NULL AND jsonb_array_length(_prizes) > 0 THEN
    INSERT INTO public.draw_prizes (draw_id, tier, hits, winners, prize_per_winner)
    SELECT _draw_id, item->>'tier', (item->>'hits')::int,
      NULLIF(item->>'winners','')::bigint, NULLIF(item->>'prize_per_winner','')::numeric
    FROM jsonb_array_elements(_prizes) item
    ON CONFLICT (draw_id, hits) DO UPDATE SET tier = EXCLUDED.tier,
      winners = EXCLUDED.winners, prize_per_winner = EXCLUDED.prize_per_winner;
    DELETE FROM public.draw_prizes dp WHERE dp.draw_id = _draw_id
      AND dp.hits NOT IN (SELECT (item->>'hits')::int FROM jsonb_array_elements(_prizes) item);
  END IF;
  RETURN _outcome;
END;
$$;
REVOKE ALL ON FUNCTION public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb) TO service_role;