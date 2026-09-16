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
  v_completed_games integer;
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
      count(*) FILTER (WHERE g.status IN ('CHECKED', 'PRIZED', 'NOT_PRIZED')),
      count(r.id),
      count(*) FILTER (WHERE r.is_prized)
    INTO v_applicable_games, v_completed_games, v_result_count, v_prized_games
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

    IF v_applicable_games > 0
      AND v_completed_games = v_applicable_games
      AND v_result_count = v_applicable_games THEN
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

CREATE OR REPLACE FUNCTION public.reconcile_pool_lifecycle_from_draw()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.reconcile_pool_lifecycle(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_pool_lifecycle_from_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.reconcile_pool_lifecycle(NEW.draw_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_pool_lifecycle_from_game_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw_id uuid;
BEGIN
  SELECT d.id INTO v_draw_id
  FROM public.generated_games g
  JOIN public.lottery_draws d
    ON d.lottery_id = g.lottery_id
   AND d.contest_number = g.contest_number
  WHERE g.id = NEW.game_id;

  IF v_draw_id IS NOT NULL THEN
    PERFORM public.reconcile_pool_lifecycle(v_draw_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lottery_draws_reconcile_pool_lifecycle ON public.lottery_draws;
CREATE TRIGGER lottery_draws_reconcile_pool_lifecycle
AFTER INSERT OR UPDATE OF draw_date, verified_at, source_updated_at
ON public.lottery_draws
FOR EACH ROW EXECUTE FUNCTION public.reconcile_pool_lifecycle_from_draw();

DROP TRIGGER IF EXISTS game_check_results_reconcile_pool_lifecycle ON public.game_check_results;
CREATE TRIGGER game_check_results_reconcile_pool_lifecycle
AFTER INSERT OR UPDATE OF is_prized, total_prize, checked_at
ON public.game_check_results
FOR EACH ROW EXECUTE FUNCTION public.reconcile_pool_lifecycle_from_check();

DROP TRIGGER IF EXISTS pool_games_reconcile_pool_lifecycle ON public.pool_games;
CREATE TRIGGER pool_games_reconcile_pool_lifecycle
AFTER INSERT ON public.pool_games
FOR EACH ROW EXECUTE FUNCTION public.reconcile_pool_lifecycle_from_game_link();

CREATE OR REPLACE FUNCTION public.pool_hub_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT p.id, p.status, p.archived_at
    FROM public.pools p
  ), classified AS (
    SELECT
      a.*,
      EXISTS (
        SELECT 1
        FROM public.pool_games pg
        JOIN public.game_check_results r ON r.game_id = pg.game_id
        WHERE pg.pool_id = a.id
      ) AS has_result
    FROM accessible a
  )
  SELECT jsonb_build_object(
    'all', count(*) FILTER (WHERE archived_at IS NULL),
    'ongoing', count(*) FILTER (
      WHERE archived_at IS NULL
        AND status IN ('FORMING', 'OPEN', 'CLOSED', 'AWAITING_DRAW', 'AWAITING_CHECK')
    ),
    'awaiting_draw', count(*) FILTER (WHERE archived_at IS NULL AND status = 'AWAITING_DRAW'),
    'result', count(*) FILTER (WHERE archived_at IS NULL AND has_result),
    'finished', count(*) FILTER (WHERE archived_at IS NULL AND status IN ('FINISHED', 'CANCELLED')),
    'archived', count(*) FILTER (WHERE archived_at IS NOT NULL)
  )
  FROM classified;
$$;

REVOKE ALL ON FUNCTION public.pool_hub_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_hub_counts() TO authenticated, service_role;

DO $$
DECLARE
  v_draw_id uuid;
BEGIN
  FOR v_draw_id IN
    SELECT DISTINCT d.id
    FROM public.lottery_draws d
    WHERE EXISTS (
      SELECT 1
      FROM public.pools p
      LEFT JOIN public.pool_games pg ON pg.pool_id = p.id
      LEFT JOIN public.generated_games g ON g.id = pg.game_id
      WHERE p.lottery_id = d.lottery_id
        AND p.status NOT IN ('FINISHED', 'CANCELLED')
        AND (
          p.contest_id = d.id
          OR p.contest_number = d.contest_number
          OR p.contest_number_planned = d.contest_number
          OR (g.lottery_id = d.lottery_id AND g.contest_number = d.contest_number)
        )
    )
  LOOP
    PERFORM public.reconcile_pool_lifecycle(v_draw_id);
  END LOOP;
END;
$$;