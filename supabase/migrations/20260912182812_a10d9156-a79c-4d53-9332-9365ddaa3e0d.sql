CREATE TYPE public.pool_share_scope AS ENUM ('PARTICIPANTS', 'GAMES', 'FULL');

CREATE TABLE public.pool_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  scope public.pool_share_scope NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
GRANT SELECT ON public.pool_share_links TO authenticated;
GRANT ALL ON public.pool_share_links TO service_role;
ALTER TABLE public.pool_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool share links owner read" ON public.pool_share_links
  FOR SELECT TO authenticated USING (public.is_pool_owner(pool_id));
CREATE UNIQUE INDEX pool_share_links_active_scope_key
  ON public.pool_share_links(pool_id, scope) WHERE revoked_at IS NULL;
CREATE INDEX pool_share_links_pool_created_idx
  ON public.pool_share_links(pool_id, created_at DESC);

INSERT INTO public.pool_share_links (pool_id, scope, token, created_by)
SELECT id, 'FULL'::public.pool_share_scope, public_token, owner_id
FROM public.pools
WHERE is_public = true AND public_token IS NOT NULL
ON CONFLICT (token) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pool_set_share_link(
  _pool_id uuid,
  _scope public.pool_share_scope,
  _enabled boolean,
  _regenerate boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _token text;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera links públicos.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_pool_id::text || ':' || _scope::text, 43));

  SELECT token INTO _token
  FROM public.pool_share_links
  WHERE pool_id = _pool_id AND scope = _scope AND revoked_at IS NULL
  FOR UPDATE;

  IF NOT _enabled THEN
    UPDATE public.pool_share_links
       SET revoked_at = now()
     WHERE pool_id = _pool_id AND scope = _scope AND revoked_at IS NULL;
    IF _scope = 'FULL' THEN
      UPDATE public.pools SET is_public = false, public_token = NULL WHERE id = _pool_id;
    END IF;
    PERFORM public.log_pool_event(
      _pool_id,
      'share_link_revoked',
      'Link público revogado',
      jsonb_build_object('scope', _scope)
    );
    RETURN NULL;
  END IF;

  IF _token IS NOT NULL AND NOT _regenerate THEN
    RETURN _token;
  END IF;

  IF _token IS NOT NULL THEN
    UPDATE public.pool_share_links
       SET revoked_at = now()
     WHERE pool_id = _pool_id AND scope = _scope AND revoked_at IS NULL;
  END IF;

  _token := encode(extensions.gen_random_bytes(16), 'hex');
  INSERT INTO public.pool_share_links(pool_id, scope, token, created_by)
  VALUES (_pool_id, _scope, _token, auth.uid());

  IF _scope = 'FULL' THEN
    UPDATE public.pools SET is_public = true, public_token = _token WHERE id = _pool_id;
  END IF;

  PERFORM public.log_pool_event(
    _pool_id,
    CASE WHEN _regenerate THEN 'share_link_regenerated' ELSE 'share_link_created' END,
    CASE WHEN _regenerate THEN 'Link público regenerado' ELSE 'Link público criado' END,
    jsonb_build_object('scope', _scope)
  );
  RETURN _token;
END;
$$;

REVOKE ALL ON FUNCTION public.pool_set_share_link(uuid, public.pool_share_scope, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pool_set_share_link(uuid, public.pool_share_scope, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_set_share_link(uuid, public.pool_share_scope, boolean, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.pool_attach_games(_pool_id uuid, _game_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pool public.pools%ROWTYPE;
  _requested integer;
  _owned integer;
  _compatible integer;
  _pool_contest integer;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador vincula jogos.' USING ERRCODE = '42501';
  END IF;

  IF _game_ids IS NULL OR cardinality(_game_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos um jogo.' USING ERRCODE = '23514';
  END IF;
  IF cardinality(_game_ids) > 200 THEN
    RAISE EXCEPTION 'Selecione no máximo 200 jogos por vez.' USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(DISTINCT game_id) INTO _requested FROM unnest(_game_ids) AS selected(game_id);
  IF _requested <> cardinality(_game_ids) THEN
    RAISE EXCEPTION 'A seleção contém jogos repetidos.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO _pool FROM public.pools WHERE id = _pool_id FOR UPDATE;
  IF _pool.id IS NULL THEN
    RAISE EXCEPTION 'Bolão não encontrado.' USING ERRCODE = '42501';
  END IF;
  IF _pool.status IN ('CANCELLED', 'FINISHED') THEN
    RAISE EXCEPTION 'Este bolão não aceita novos jogos.' USING ERRCODE = '23514';
  END IF;
  _pool_contest := COALESCE(_pool.contest_number, _pool.contest_number_planned);

  SELECT COUNT(*) INTO _owned
  FROM public.generated_games gg
  WHERE gg.id = ANY(_game_ids) AND gg.user_id = auth.uid();
  IF _owned <> _requested THEN
    RAISE EXCEPTION 'Um ou mais jogos não pertencem a você ou não existem.' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO _compatible
  FROM public.generated_games gg
  WHERE gg.id = ANY(_game_ids)
    AND gg.user_id = auth.uid()
    AND gg.lottery_id = _pool.lottery_id
    AND NOT (
      gg.contest_number IS NOT NULL
      AND _pool_contest IS NOT NULL
      AND gg.contest_number <> _pool_contest
    );
  IF _compatible <> _requested THEN
    RAISE EXCEPTION 'Um ou mais jogos são incompatíveis com a modalidade ou concurso do bolão.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pool_games pg WHERE pg.game_id = ANY(_game_ids)
  ) THEN
    RAISE EXCEPTION 'Um ou mais jogos selecionados já estão vinculados a um bolão.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.pool_games(pool_id, game_id)
  SELECT _pool_id, selected.game_id FROM unnest(_game_ids) AS selected(game_id);

  PERFORM public.log_pool_event(
    _pool_id,
    'games_linked',
    _requested::text || CASE WHEN _requested = 1 THEN ' jogo vinculado ao bolão' ELSE ' jogos vinculados ao bolão' END,
    jsonb_build_object('count', _requested)
  );
  RETURN _requested;
END;
$$;

REVOKE ALL ON FUNCTION public.pool_attach_games(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pool_attach_games(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_attach_games(uuid, uuid[]) TO service_role;

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
  linked AS (
    SELECT gg.id, gg.created_at, gg.status
    FROM public.pool_games pg
    JOIN p ON p.id = pg.pool_id
    JOIN public.generated_games gg ON gg.id = pg.game_id
  ),
  g AS (
    SELECT linked.id,
           row_number() OVER (ORDER BY linked.created_at, linked.id) AS ordinal,
           linked.status,
           COALESCE((SELECT array_agg(gn.number ORDER BY gn.number)
                     FROM public.game_numbers gn WHERE gn.game_id = linked.id), '{}') AS numbers,
           r.hits, r.is_prized, r.prize_label, r.total_prize
    FROM linked
    LEFT JOIN public.game_check_results r ON r.game_id = linked.id
    WHERE linked.status IN ('BET','RECEIPTED','AWAITING_DRAW','AWAITING_CHECK','CHECKED','PRIZED','NOT_PRIZED')
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
      'linkedGames', (SELECT COUNT(*) FROM linked),
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

CREATE OR REPLACE FUNCTION public.pool_set_public(_pool_id uuid, _enabled boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.pool_set_share_link(_pool_id, 'FULL', _enabled, _enabled);
END;
$$;

REVOKE ALL ON FUNCTION public.pool_set_public(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pool_set_public(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_set_public(uuid, boolean) TO service_role;