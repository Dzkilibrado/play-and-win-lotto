CREATE OR REPLACE FUNCTION public.reconcile_pool_lifecycle(_draw_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw public.lottery_draws%ROWTYPE;
  v_pool public.pools%ROWTYPE;
  v_previous_status public.pool_status;
  v_next_status public.pool_status;
  v_applicable_games integer;
  v_result_count integer;
  v_prized_games integer;
  v_changed integer := 0;
BEGIN
  SELECT * INTO v_draw
  FROM public.lottery_draws
  WHERE id = _draw_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  FOR v_pool IN
    SELECT p.*
    FROM public.pools p
    WHERE p.lottery_id = v_draw.lottery_id
      AND p.status NOT IN ('FINISHED', 'CANCELLED')
      AND (
        p.contest_id = v_draw.id
        OR p.contest_number = v_draw.contest_number
        OR p.contest_number_planned = v_draw.contest_number
        OR EXISTS (
          SELECT 1
          FROM public.pool_games pg
          JOIN public.generated_games g ON g.id = pg.game_id
          WHERE pg.pool_id = p.id
            AND g.lottery_id = v_draw.lottery_id
            AND g.contest_number = v_draw.contest_number
        )
      )
    FOR UPDATE
  LOOP
    v_previous_status := v_pool.status;
    v_next_status := v_pool.status;

    SELECT
      count(*) FILTER (WHERE g.status <> 'PLANNED'),
      count(r.id),
      count(*) FILTER (WHERE r.is_prized)
    INTO v_applicable_games, v_result_count, v_prized_games
    FROM public.pool_games pg
    JOIN public.generated_games g ON g.id = pg.game_id
    LEFT JOIN public.game_check_results r
      ON r.game_id = g.id AND r.draw_id = v_draw.id
    WHERE pg.pool_id = v_pool.id
      AND g.lottery_id = v_draw.lottery_id
      AND g.contest_number = v_draw.contest_number
      AND g.status <> 'PLANNED';

    IF v_pool.status = 'AWAITING_DRAW' THEN
      v_next_status := 'AWAITING_CHECK';
    END IF;

    IF v_applicable_games > 0 AND v_result_count = v_applicable_games THEN
      v_next_status := CASE WHEN v_prized_games > 0 THEN 'PRIZED'::public.pool_status ELSE 'CHECKED'::public.pool_status END;
    END IF;

    UPDATE public.pools
    SET contest_id = v_draw.id,
        contest_number = v_draw.contest_number,
        draw_date = v_draw.draw_date,
        status = v_next_status,
        updated_at = now()
    WHERE id = v_pool.id
      AND (
        contest_id IS DISTINCT FROM v_draw.id
        OR contest_number IS DISTINCT FROM v_draw.contest_number
        OR draw_date IS DISTINCT FROM v_draw.draw_date
        OR status IS DISTINCT FROM v_next_status
      );

    IF FOUND THEN
      v_changed := v_changed + 1;

      IF v_previous_status IS DISTINCT FROM v_next_status THEN
        INSERT INTO public.pool_events (pool_id, actor_id, event_type, description, metadata)
        VALUES (
          v_pool.id,
          NULL,
          'STATUS_CHANGED',
          'Situação atualizada automaticamente após o processamento do resultado oficial.',
          jsonb_build_object(
            'from', v_previous_status,
            'to', v_next_status,
            'draw_id', v_draw.id,
            'contest_number', v_draw.contest_number,
            'source', 'automatic_lifecycle_reconciliation'
          )
        );

        INSERT INTO public.audit_logs (user_id, entity_type, entity_id, action, metadata)
        VALUES (
          NULL,
          'pool',
          v_pool.id,
          'pool_lifecycle_reconciled',
          jsonb_build_object(
            'from', v_previous_status,
            'to', v_next_status,
            'draw_id', v_draw.id,
            'contest_number', v_draw.contest_number
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_changed;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_pool_lifecycle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_pool_lifecycle(uuid) TO service_role;