-- Dia de Sorte e Timemania: seleção secundária (Mês da Sorte / Time do Coração).
--
--   1. Corrige a Timemania cadastrada na fundação: a aposta é FIXA em 10
--      dezenas (sem apostas múltiplas) — remove as faixas de preço de 11 a 15.
--   2. `generated_games.secondary_selection` e `lottery_draws.secondary_result`
--      guardam a escolha do jogo e o resultado oficial (chaves canônicas:
--      "01".."12" para o mês; nome normalizado do clube para o Time).
--   3. `draw_secondary_prizes`: faixa própria do Mês/Time (paga sem acerto de
--      dezenas), separada de `draw_prizes` para não afetar quem lê as faixas
--      de dezenas.
--   4. `lottery_secondary_options`: catálogo de opções editável (os clubes da
--      Timemania mudam a cada biênio por portaria do Ministério do Esporte).
--   5. Trigger que impede gravar seleção inválida para a modalidade.
--   6. `persist_official_draw` ganha o 7º parâmetro opcional `_secondary`.
--
-- Idempotente: pode rodar mais de uma vez sem erro.

-- ---- 1. Timemania: aposta fixa de 10 dezenas ----
UPDATE public.lotteries SET max_selectable = 10 WHERE slug = 'timemania';
DELETE FROM public.lottery_prices
WHERE numbers_selected > 10
  AND lottery_id = (SELECT id FROM public.lotteries WHERE slug = 'timemania');

-- ---- 2. colunas ----
ALTER TABLE public.generated_games
  ADD COLUMN IF NOT EXISTS secondary_selection text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.lottery_draws
  ADD COLUMN IF NOT EXISTS secondary_result text[] NOT NULL DEFAULT '{}';

-- ---- 3. faixa própria da seleção secundária ----
CREATE TABLE IF NOT EXISTS public.draw_secondary_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  tier text NOT NULL,
  winners bigint,
  prize_per_winner numeric(16,2),
  UNIQUE (draw_id, tier)
);
GRANT SELECT ON public.draw_secondary_prizes TO anon, authenticated;
GRANT ALL ON public.draw_secondary_prizes TO service_role;
ALTER TABLE public.draw_secondary_prizes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "draw secondary prizes public read" ON public.draw_secondary_prizes;
CREATE POLICY "draw secondary prizes public read" ON public.draw_secondary_prizes
  FOR SELECT TO anon, authenticated USING (true);

-- ---- 4. catálogo de opções (clubes da Timemania) ----
CREATE TABLE IF NOT EXISTS public.lottery_secondary_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  value text NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lottery_id, value)
);
GRANT SELECT ON public.lottery_secondary_options TO anon, authenticated;
GRANT ALL ON public.lottery_secondary_options TO service_role;
ALTER TABLE public.lottery_secondary_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "secondary options public read" ON public.lottery_secondary_options;
CREATE POLICY "secondary options public read" ON public.lottery_secondary_options
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "secondary options admin write" ON public.lottery_secondary_options;
CREATE POLICY "secondary options admin write" ON public.lottery_secondary_options
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
GRANT INSERT, UPDATE, DELETE ON public.lottery_secondary_options TO authenticated;

-- ---- 5. seleção secundária válida para a modalidade ----
CREATE OR REPLACE FUNCTION public.guard_game_secondary()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _kind text;
  _value text;
BEGIN
  SELECT secondary_kind INTO _kind FROM public.lotteries WHERE id = NEW.lottery_id;

  IF cardinality(NEW.secondary_selection) = 0 THEN
    RETURN NEW;
  END IF;

  IF _kind IS NULL OR _kind NOT IN ('mes', 'time') THEN
    RAISE EXCEPTION 'Esta modalidade não tem seleção secundária.' USING ERRCODE = 'check_violation';
  END IF;
  IF cardinality(NEW.secondary_selection) <> 1 THEN
    RAISE EXCEPTION 'Escolha exatamente uma opção (%).', _kind USING ERRCODE = 'check_violation';
  END IF;

  _value := NEW.secondary_selection[1];
  IF _kind = 'mes' AND _value !~ '^(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Mês da Sorte inválido: %', _value USING ERRCODE = 'check_violation';
  END IF;
  IF _kind = 'time' AND NOT EXISTS (
    SELECT 1 FROM public.lottery_secondary_options o
    WHERE o.lottery_id = NEW.lottery_id AND o.value = _value AND o.is_active
  ) THEN
    RAISE EXCEPTION 'Time do Coração inválido: %', _value USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generated_games_guard_secondary ON public.generated_games;
CREATE TRIGGER generated_games_guard_secondary
  BEFORE INSERT OR UPDATE OF secondary_selection, lottery_id ON public.generated_games
  FOR EACH ROW EXECUTE FUNCTION public.guard_game_secondary();

-- ---- 6. persist_official_draw: 7º parâmetro opcional ----
-- `_secondary` = {"result": ["03"], "prize": {tier, winners, prize_per_winner}}
-- ou NULL. Sem `_secondary`, o comportamento (e o instantâneo de retificação)
-- continua idêntico ao anterior.
DROP FUNCTION IF EXISTS public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.persist_official_draw(
  _lottery_id uuid,
  _contest_number integer,
  _draw jsonb,
  _numbers jsonb,
  _prizes jsonb,
  _second jsonb DEFAULT NULL,
  _secondary jsonb DEFAULT NULL
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
  _second_numbers jsonb := NULL;
  _second_prizes jsonb := NULL;
  _sec_result jsonb := NULL;
  _sec_prize jsonb := NULL;
BEGIN
  IF _contest_number IS NULL OR _contest_number <= 0 THEN
    RAISE EXCEPTION 'contest_number inválido: %', _contest_number;
  END IF;
  IF _numbers IS NULL OR jsonb_array_length(_numbers) = 0 THEN
    RAISE EXCEPTION 'concurso % sem dezenas: persistência recusada', _contest_number;
  END IF;
  IF _second IS NOT NULL AND jsonb_typeof(_second) = 'object' THEN
    _second_numbers := _second->'numbers';
    _second_prizes := COALESCE(_second->'prizes', '[]'::jsonb);
    IF _second_numbers IS NULL OR jsonb_typeof(_second_numbers) <> 'array'
       OR jsonb_array_length(_second_numbers) = 0 THEN
      RAISE EXCEPTION 'concurso % com 2º sorteio sem dezenas: persistência recusada', _contest_number;
    END IF;
  END IF;
  IF _secondary IS NOT NULL AND jsonb_typeof(_secondary) = 'object' THEN
    _sec_result := _secondary->'result';
    _sec_prize := _secondary->'prize';
    IF _sec_result IS NULL OR jsonb_typeof(_sec_result) <> 'array'
       OR jsonb_array_length(_sec_result) = 0 THEN
      RAISE EXCEPTION 'concurso % com seleção secundária sem resultado: persistência recusada', _contest_number;
    END IF;
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
  IF _sec_result IS NOT NULL THEN
    _incoming := _incoming || jsonb_build_object('secondary', jsonb_build_object(
      'result', (SELECT jsonb_agg(item #>> '{}' ORDER BY item #>> '{}') FROM jsonb_array_elements(_sec_result) item),
      'prize', CASE WHEN _sec_prize IS NULL OR jsonb_typeof(_sec_prize) <> 'object' THEN NULL
        ELSE jsonb_build_object('tier', _sec_prize->>'tier', 'winners', NULLIF(_sec_prize->>'winners','')::bigint, 'prize_per_winner', NULLIF(_sec_prize->>'prize_per_winner','')::numeric) END
    ));
  END IF;
  IF _second_numbers IS NOT NULL THEN
    _incoming := _incoming || jsonb_build_object('second', jsonb_build_object(
      'numbers', COALESCE((SELECT jsonb_agg(jsonb_build_object('number', (item->>'number')::int, 'position', (item->>'position')::int) ORDER BY (item->>'position')::int) FROM jsonb_array_elements(_second_numbers) item), '[]'::jsonb),
      'prizes', COALESCE((SELECT jsonb_agg(jsonb_build_object('tier', item->>'tier', 'hits', (item->>'hits')::int, 'winners', NULLIF(item->>'winners','')::bigint, 'prize_per_winner', NULLIF(item->>'prize_per_winner','')::numeric) ORDER BY (item->>'hits')::int) FROM jsonb_array_elements(_second_prizes) item), '[]'::jsonb)
    ));
  END IF;

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

    IF EXISTS (SELECT 1 FROM public.draw_second_numbers WHERE draw_id = _draw_id) THEN
      _previous := _previous || jsonb_build_object('second', jsonb_build_object(
        'numbers', COALESCE((SELECT jsonb_agg(jsonb_build_object('number', n.number, 'position', n.position) ORDER BY n.position) FROM public.draw_second_numbers n WHERE n.draw_id = _draw_id), '[]'::jsonb),
        'prizes', COALESCE((SELECT jsonb_agg(jsonb_build_object('tier', p.tier, 'hits', p.hits, 'winners', p.winners, 'prize_per_winner', p.prize_per_winner) ORDER BY p.hits) FROM public.draw_second_prizes p WHERE p.draw_id = _draw_id), '[]'::jsonb)
      ));
    END IF;

    IF cardinality((SELECT secondary_result FROM public.lottery_draws WHERE id = _draw_id)) > 0 THEN
      _previous := _previous || jsonb_build_object('secondary', jsonb_build_object(
        'result', (SELECT jsonb_agg(v ORDER BY v) FROM unnest((SELECT secondary_result FROM public.lottery_draws WHERE id = _draw_id)) v),
        'prize', (SELECT jsonb_build_object('tier', p.tier, 'winners', p.winners, 'prize_per_winner', p.prize_per_winner) FROM public.draw_secondary_prizes p WHERE p.draw_id = _draw_id LIMIT 1)
      ));
    END IF;

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

  -- 1º sorteio (comportamento original)
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

  -- 2º sorteio (mesma transação)
  IF _second_numbers IS NOT NULL THEN
    INSERT INTO public.draw_second_numbers (draw_id, number, position)
    SELECT _draw_id, (item->>'number')::int, (item->>'position')::int
    FROM jsonb_array_elements(_second_numbers) item
    ON CONFLICT (draw_id, number) DO UPDATE SET position = EXCLUDED.position;
    DELETE FROM public.draw_second_numbers dn WHERE dn.draw_id = _draw_id
      AND dn.number NOT IN (SELECT (item->>'number')::int FROM jsonb_array_elements(_second_numbers) item);

    IF jsonb_array_length(_second_prizes) > 0 THEN
      INSERT INTO public.draw_second_prizes (draw_id, tier, hits, winners, prize_per_winner)
      SELECT _draw_id, item->>'tier', (item->>'hits')::int,
        NULLIF(item->>'winners','')::bigint, NULLIF(item->>'prize_per_winner','')::numeric
      FROM jsonb_array_elements(_second_prizes) item
      ON CONFLICT (draw_id, hits) DO UPDATE SET tier = EXCLUDED.tier,
        winners = EXCLUDED.winners, prize_per_winner = EXCLUDED.prize_per_winner;
      DELETE FROM public.draw_second_prizes dp WHERE dp.draw_id = _draw_id
        AND dp.hits NOT IN (SELECT (item->>'hits')::int FROM jsonb_array_elements(_second_prizes) item);
    END IF;
  ELSE
    DELETE FROM public.draw_second_numbers WHERE draw_id = _draw_id;
    DELETE FROM public.draw_second_prizes WHERE draw_id = _draw_id;
  END IF;

  -- Seleção secundária (Mês da Sorte / Time do Coração), mesma transação.
  IF _sec_result IS NOT NULL THEN
    UPDATE public.lottery_draws SET secondary_result = COALESCE(
      (SELECT array_agg(DISTINCT item #>> '{}' ORDER BY item #>> '{}') FROM jsonb_array_elements(_sec_result) item), '{}')
    WHERE id = _draw_id;
    DELETE FROM public.draw_secondary_prizes WHERE draw_id = _draw_id;
    IF _sec_prize IS NOT NULL AND jsonb_typeof(_sec_prize) = 'object' THEN
      INSERT INTO public.draw_secondary_prizes (draw_id, tier, winners, prize_per_winner)
      VALUES (_draw_id, _sec_prize->>'tier', NULLIF(_sec_prize->>'winners','')::bigint,
        NULLIF(_sec_prize->>'prize_per_winner','')::numeric);
    END IF;
  ELSE
    UPDATE public.lottery_draws SET secondary_result = '{}' WHERE id = _draw_id AND cardinality(secondary_result) > 0;
    DELETE FROM public.draw_secondary_prizes WHERE draw_id = _draw_id;
  END IF;

  RETURN _outcome;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb) TO service_role;
