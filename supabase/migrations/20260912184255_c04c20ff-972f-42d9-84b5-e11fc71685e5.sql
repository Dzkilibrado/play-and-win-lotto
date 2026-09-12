CREATE OR REPLACE FUNCTION public.pool_set_games_status(
  _pool_id uuid,
  _game_ids uuid[],
  _status public.game_status
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _manual public.game_status[] := ARRAY['PLANNED','BET','RECEIPTED','AWAITING_DRAW','AWAITING_CHECK']::public.game_status[];
  _requested integer;
  _owned integer;
  _invalid_result integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Apenas o organizador pode alterar os jogos deste bolão.' USING ERRCODE = '42501';
  END IF;

  IF _game_ids IS NULL OR cardinality(_game_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um jogo.' USING ERRCODE = '22023';
  END IF;

  IF cardinality(_game_ids) > 200 THEN
    RAISE EXCEPTION 'Selecione no máximo 200 jogos por vez.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(_game_ids) id GROUP BY id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'A seleção contém jogos repetidos.' USING ERRCODE = '22023';
  END IF;

  IF NOT (_status = ANY(_manual)) THEN
    RAISE EXCEPTION 'Situação de resultado só pode ser gravada pela conferência oficial.' USING ERRCODE = '42501';
  END IF;

  _requested := cardinality(_game_ids);

  PERFORM 1
  FROM public.generated_games gg
  WHERE gg.id = ANY(_game_ids)
  ORDER BY gg.id
  FOR UPDATE;

  SELECT count(*) INTO _owned
  FROM public.generated_games gg
  JOIN public.pool_games pg ON pg.game_id = gg.id AND pg.pool_id = _pool_id
  WHERE gg.id = ANY(_game_ids)
    AND gg.user_id = auth.uid();

  IF _owned <> _requested THEN
    RAISE EXCEPTION 'Um ou mais jogos não pertencem a você ou não estão vinculados a este bolão.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _invalid_result
  FROM public.generated_games gg
  WHERE gg.id = ANY(_game_ids)
    AND NOT (gg.status = ANY(_manual));

  IF _invalid_result > 0 THEN
    RAISE EXCEPTION 'Um ou mais jogos já foram conferidos; a situação é definida pelo resultado oficial.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.generated_games
  SET status = _status
  WHERE id = ANY(_game_ids);

  RETURN _requested;
END;
$$;

REVOKE ALL ON FUNCTION public.pool_set_games_status(uuid, uuid[], public.game_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_set_games_status(uuid, uuid[], public.game_status) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pool_public_summary(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH link AS (
    SELECT psl.pool_id, psl.scope
    FROM public.pool_share_links psl
    WHERE psl.token = _token AND psl.revoked_at IS NULL
    LIMIT 1
  ),
  p AS (
    SELECT pools.*, link.scope
    FROM public.pools pools
    JOIN link ON link.pool_id = pools.id
  ),
  d AS (
    SELECT ld.* FROM public.lottery_draws ld JOIN p ON p.lottery_id = ld.lottery_id
    WHERE ld.contest_number = COALESCE(p.contest_number, p.contest_number_planned)
    LIMIT 1
  ),
  part AS (
    SELECT row_number() OVER (ORDER BY pp.name, pp.created_at, pp.id) AS ordinal,
           pp.name, pp.quotas
    FROM public.pool_participants pp JOIN p ON p.id = pp.pool_id
    WHERE pp.status = 'ACTIVE' AND pp.payment_status = 'PAID'
  ),
  g AS (
    SELECT gg.id,
           row_number() OVER (ORDER BY gg.created_at, gg.id) AS ordinal,
           gg.status,
           COALESCE((SELECT array_agg(gn.number ORDER BY gn.number)
                     FROM public.game_numbers gn WHERE gn.game_id = gg.id), '{}') AS numbers,
           r.hits, r.is_prized, r.prize_label, r.total_prize
    FROM public.pool_games pg
    JOIN p ON p.id = pg.pool_id
    JOIN public.generated_games gg ON gg.id = pg.game_id
    LEFT JOIN public.game_check_results r ON r.game_id = gg.id
  ),
  base AS (
    SELECT jsonb_build_object(
      'scope', p.scope,
      'name', p.name,
      'lottery', l.name,
      'lotterySlug', l.slug,
      'contestNumber', COALESCE(p.contest_number, p.contest_number_planned),
      'drawDate', COALESCE(p.draw_date, p.draw_date_planned),
      'drawDatePlanned', (p.draw_date IS NULL),
      'status', p.status
    ) AS value,
    p.*
    FROM p JOIN public.lotteries l ON l.id = p.lottery_id
  ),
  participant_payload AS (
    SELECT jsonb_build_object(
      'quotaValue', base.quota_value,
      'totalQuotas', base.total_quotas,
      'assignedQuotas', COALESCE((SELECT SUM(pp.quotas) FROM public.pool_participants pp
        WHERE pp.pool_id = base.id AND pp.status = 'ACTIVE'), 0),
      'paidQuotas', COALESCE((SELECT SUM(part.quotas) FROM part), 0),
      'confirmedParticipants', (SELECT COUNT(*) FROM part),
      'availableQuotas', CASE WHEN base.total_quotas IS NULL THEN NULL ELSE GREATEST(
        base.total_quotas - COALESCE((SELECT SUM(pp.quotas) FROM public.pool_participants pp
          WHERE pp.pool_id = base.id AND pp.status = 'ACTIVE'), 0), 0) END,
      'participants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'ordinal', part.ordinal,
          'name', part.name,
          'quotas', part.quotas,
          'paymentStatus', 'PAID'
        ) ORDER BY part.ordinal) FROM part
      ), '[]'::jsonb)
    ) AS value FROM base
  ),
  game_payload AS (
    SELECT jsonb_build_object(
      'linkedGames', (SELECT COUNT(*) FROM g),
      'confirmedBets', (SELECT COUNT(*) FROM g WHERE g.status <> 'PLANNED'),
      'games', (SELECT COUNT(*) FROM g),
      'gameList', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'ordinal', g.ordinal,
          'numbers', g.numbers,
          'status', g.status,
          'hits', g.hits,
          'isPrized', g.is_prized,
          'prizeLabel', g.prize_label,
          'prizeAmount', g.total_prize
        ) ORDER BY g.ordinal) FROM g
      ), '[]'::jsonb),
      'result', (
        SELECT CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
          'contestNumber', d.contest_number,
          'drawDate', d.draw_date,
          'drawnNumbers', COALESCE((SELECT array_agg(dn.number ORDER BY dn.number)
                                    FROM public.draw_numbers dn WHERE dn.draw_id = d.id), '{}'),
          'checkedGames', (SELECT COUNT(*) FROM g WHERE g.hits IS NOT NULL),
          'prizedGames', (SELECT COUNT(*) FROM g WHERE g.is_prized),
          'totalPrize', (SELECT SUM(g.total_prize) FROM g WHERE g.is_prized)
        ) END FROM d
      )
    ) AS value FROM base
  )
  SELECT base.value
    || CASE WHEN base.scope IN ('PARTICIPANTS','FULL') THEN participant_payload.value ELSE '{}'::jsonb END
    || CASE WHEN base.scope IN ('GAMES','FULL') THEN game_payload.value ELSE '{}'::jsonb END
  FROM base CROSS JOIN participant_payload CROSS JOIN game_payload;
$$;

REVOKE ALL ON FUNCTION public.pool_public_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pool_public_summary(text) TO anon, authenticated, service_role;