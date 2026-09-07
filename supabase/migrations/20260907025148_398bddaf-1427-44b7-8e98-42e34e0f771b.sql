CREATE TABLE public.game_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL UNIQUE REFERENCES public.generated_games(id) ON DELETE CASCADE,
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  contest_number integer NOT NULL,
  hits integer NOT NULL,
  matched_numbers integer[] NOT NULL DEFAULT '{}',
  is_prized boolean NOT NULL DEFAULT false,
  prize_tier_hits integer,
  prize_label text,
  total_prize numeric,
  amount_pending boolean NOT NULL DEFAULT false,
  calculation_version integer NOT NULL DEFAULT 1,
  source_updated_at timestamptz,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_check_results TO authenticated;
GRANT ALL ON public.game_check_results TO service_role;
ALTER TABLE public.game_check_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or pool game check results" ON public.game_check_results
  FOR SELECT TO authenticated USING (public.can_read_game(game_id));

CREATE INDEX game_check_results_draw_idx ON public.game_check_results(draw_id);
CREATE INDEX game_check_results_prized_idx ON public.game_check_results(is_prized);
CREATE TRIGGER game_check_results_updated_at BEFORE UPDATE ON public.game_check_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.game_prize_breakdown (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_result_id uuid NOT NULL REFERENCES public.game_check_results(id) ON DELETE CASCADE,
  draw_prize_id uuid REFERENCES public.draw_prizes(id) ON DELETE SET NULL,
  tier text NOT NULL,
  hits_required integer NOT NULL,
  winning_combinations bigint NOT NULL,
  prize_per_combination numeric,
  total_for_tier numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (check_result_id, hits_required)
);

GRANT SELECT ON public.game_prize_breakdown TO authenticated;
GRANT ALL ON public.game_prize_breakdown TO service_role;
ALTER TABLE public.game_prize_breakdown ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own prize breakdown" ON public.game_prize_breakdown
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.game_check_results r
      WHERE r.id = check_result_id AND public.can_read_game(r.game_id)
    )
  );

CREATE TABLE public.game_check_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.generated_games(id) ON DELETE CASCADE,
  draw_id uuid REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  job_id uuid,
  error_type text NOT NULL,
  message text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_check_errors TO authenticated;
GRANT ALL ON public.game_check_errors TO service_role;
ALTER TABLE public.game_check_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own game check errors" ON public.game_check_errors
  FOR SELECT TO authenticated USING (game_id IS NOT NULL AND public.can_read_game(game_id));
CREATE POLICY "Admins read all game check errors" ON public.game_check_errors
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE INDEX game_check_errors_draw_idx ON public.game_check_errors(draw_id);

CREATE TABLE public.game_check_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  processed integer NOT NULL DEFAULT 0,
  prized integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  last_game_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_check_jobs TO authenticated;
GRANT ALL ON public.game_check_jobs TO service_role;
ALTER TABLE public.game_check_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read game check jobs" ON public.game_check_jobs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE UNIQUE INDEX game_check_jobs_open_draw_idx ON public.game_check_jobs(draw_id)
  WHERE status IN ('pending', 'running');
CREATE TRIGGER game_check_jobs_updated_at BEFORE UPDATE ON public.game_check_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS generated_games_draw_status_idx
  ON public.generated_games(draw_id, status);

-- Persistência atômica de uma conferência: resultado principal, decomposição
-- por faixa e situação do jogo gravados na mesma transação, com trava por jogo.
CREATE OR REPLACE FUNCTION public.apply_game_check(_game_id uuid, _draw_id uuid, _payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result_id uuid;
  _is_prized boolean := COALESCE((_payload->>'is_prized')::boolean, false);
  _status game_status;
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.apply_game_check(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_game_check(uuid, uuid, jsonb) TO service_role;

-- Move para "Aguardando conferência" os jogos apostados/comprovados cujo
-- concurso já foi sorteado. Nunca mexe em jogos apenas planejados.
CREATE OR REPLACE FUNCTION public.mark_games_awaiting_check(_draw_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _count integer;
BEGIN
  WITH d AS (SELECT lottery_id, contest_number FROM lottery_draws WHERE id = _draw_id)
  UPDATE generated_games g SET status = 'AWAITING_CHECK', draw_id = _draw_id
  FROM d
  WHERE g.lottery_id = d.lottery_id
    AND g.contest_number = d.contest_number
    AND g.status IN ('BET','RECEIPTED','AWAITING_DRAW');
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_games_awaiting_check(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_games_awaiting_check(uuid) TO service_role;