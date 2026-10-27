-- ============================================================
-- Dupla Sena — 2 sorteios por concurso (opção A: resultado por sorteio)
-- ============================================================
-- Desenho:
--   * Continua existindo UMA linha em `lottery_draws` por concurso, e
--     `draw_numbers`/`draw_prizes` continuam sendo o 1º sorteio. Assim
--     nenhuma tela, gatilho ou consulta existente muda de comportamento.
--   * O 2º sorteio vive em tabelas próprias (`draw_second_numbers`,
--     `draw_second_prizes`), gravadas na MESMA transação do 1º.
--   * Cada jogo continua com UMA linha somada em `game_check_results`
--     (é o que bolão, rateio e filtros já leem). O resultado de cada
--     sorteio fica em `game_check_draw_results` (opção A).
-- ============================================================

-- ---- 1. desfaz o `draw_sequence` de lottery_draws (PR #7) ----
-- Nunca houve linha com sequência diferente de 1; a coluna só enfraquecia
-- a unicidade (lottery_id, contest_number) de que o resto do app depende.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lottery_draws' AND column_name = 'draw_sequence'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.lottery_draws WHERE draw_sequence <> 1) THEN
      RAISE EXCEPTION 'lottery_draws.draw_sequence com valor diferente de 1: revisar antes de remover';
    END IF;
  END IF;
END $$;

ALTER TABLE public.lottery_draws
  DROP CONSTRAINT IF EXISTS lottery_draws_lottery_id_contest_number_sequence_key;
ALTER TABLE public.lottery_draws
  DROP CONSTRAINT IF EXISTS lottery_draws_lottery_id_contest_number_key;
ALTER TABLE public.lottery_draws
  ADD CONSTRAINT lottery_draws_lottery_id_contest_number_key UNIQUE (lottery_id, contest_number);
ALTER TABLE public.lottery_draws DROP COLUMN IF EXISTS draw_sequence;

-- ---- 2. faixa de Terno (3 acertos) da Dupla Sena ----
-- Fonte oficial (loterias.caixa.gov.br/Paginas/Dupla-Sena.aspx): os DOIS
-- sorteios pagam Sena, Quina, Quadra e Terno. O PR #7 só cadastrou 6/5/4.
INSERT INTO public.lottery_prize_tiers (lottery_id, hits, label, sort_order)
SELECT id, 3, 'Terno', 4 FROM public.lotteries WHERE slug = 'dupla-sena'
ON CONFLICT (lottery_id, hits) DO NOTHING;

-- ---- 3. 2º sorteio do concurso ----
CREATE TABLE public.draw_second_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  number int NOT NULL,
  position int NOT NULL DEFAULT 0,
  UNIQUE (draw_id, number)
);
GRANT SELECT ON public.draw_second_numbers TO anon, authenticated;
GRANT ALL ON public.draw_second_numbers TO service_role;
ALTER TABLE public.draw_second_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draw second numbers public read" ON public.draw_second_numbers
  FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.draw_second_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  tier text NOT NULL,
  hits int NOT NULL,
  winners bigint NOT NULL DEFAULT 0,
  prize_per_winner numeric(16,2) NOT NULL DEFAULT 0,
  UNIQUE (draw_id, hits)
);
GRANT SELECT ON public.draw_second_prizes TO anon, authenticated;
GRANT ALL ON public.draw_second_prizes TO service_role;
ALTER TABLE public.draw_second_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draw second prizes public read" ON public.draw_second_prizes
  FOR SELECT TO anon, authenticated USING (true);

-- ---- 4. resultado por sorteio de cada jogo ----
CREATE TABLE public.game_check_draw_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_result_id uuid NOT NULL REFERENCES public.game_check_results(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.generated_games(id) ON DELETE CASCADE,
  draw_sequence int NOT NULL CHECK (draw_sequence BETWEEN 1 AND 2),
  hits integer NOT NULL,
  matched_numbers integer[] NOT NULL DEFAULT '{}',
  is_prized boolean NOT NULL DEFAULT false,
  prize_label text,
  total_prize numeric,
  amount_pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (check_result_id, draw_sequence)
);
CREATE INDEX game_check_draw_results_game_idx ON public.game_check_draw_results (game_id);
GRANT SELECT ON public.game_check_draw_results TO authenticated;
GRANT ALL ON public.game_check_draw_results TO service_role;
ALTER TABLE public.game_check_draw_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or pool game check draw results" ON public.game_check_draw_results
  FOR SELECT TO authenticated USING (public.can_read_game(game_id));

-- ---- 5. apply_game_check: aceita o detalhe por sorteio (opcional) ----
-- Mesma assinatura e mesmo comportamento de antes; só acrescenta a
-- gravação de `_payload->'draws'` quando o payload traz esse detalhe.
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

  -- Detalhe por sorteio (só modalidades com mais de um sorteio por concurso).
  DELETE FROM game_check_draw_results WHERE check_result_id = _result_id;
  IF jsonb_typeof(_payload->'draws') = 'array' THEN
    INSERT INTO game_check_draw_results (
      check_result_id, game_id, draw_sequence, hits, matched_numbers,
      is_prized, prize_label, total_prize, amount_pending
    )
    SELECT _result_id, _game_id,
           (item->>'draw_sequence')::integer,
           (item->>'hits')::integer,
           COALESCE((SELECT array_agg(value::int ORDER BY value::int)
                     FROM jsonb_array_elements_text(COALESCE(item->'matched_numbers','[]'::jsonb)) AS value), '{}'),
           COALESCE((item->>'is_prized')::boolean, false),
           item->>'prize_label',
           NULLIF(item->>'total_prize','')::numeric,
           COALESCE((item->>'amount_pending')::boolean, false)
    FROM jsonb_array_elements(_payload->'draws') AS item;
  END IF;

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

-- ---- 6. persist_official_draw: 6º parâmetro opcional com o 2º sorteio ----
-- `_second` = {"numbers": [{number, position}...], "prizes": [{tier, hits,
-- winners, prize_per_winner}...]} ou NULL. Sem `_second`, o comportamento
-- (e o instantâneo usado para detectar retificação) é idêntico ao anterior.
DROP FUNCTION IF EXISTS public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.persist_official_draw(
  _lottery_id uuid,
  _contest_number integer,
  _draw jsonb,
  _numbers jsonb,
  _prizes jsonb,
  _second jsonb DEFAULT NULL
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

  RETURN _outcome;
END;
$$;
REVOKE ALL ON FUNCTION public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_official_draw(uuid, integer, jsonb, jsonb, jsonb, jsonb) TO service_role;
