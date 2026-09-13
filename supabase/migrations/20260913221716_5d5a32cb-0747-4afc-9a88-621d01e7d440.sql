-- lovable-cron-fallback-reviewed: 144 runs/day; a consulta local barata limita o atraso pós-sorteio a 10 minutos sem chamar o aplicativo ou a fonte oficial quando nenhuma ação está vencida
ALTER TABLE public.lottery_sync_state
  ADD COLUMN next_action_kind text NOT NULL DEFAULT 'HEALTH_CHECK'
    CHECK (next_action_kind IN ('HEALTH_CHECK','PRE_DRAW_CHECK','WAIT_PUBLICATION','RETRY','CONSISTENCY_CHECK')),
  ADD COLUMN last_health_check_at timestamptz,
  ADD COLUMN last_consistency_check_at timestamptz,
  ADD COLUMN consistency_contest_number integer
    CHECK (consistency_contest_number IS NULL OR consistency_contest_number > 0);

CREATE INDEX lottery_sync_state_action_due_idx
  ON public.lottery_sync_state (next_action_kind, next_attempt_at)
  WHERE enabled;

CREATE OR REPLACE FUNCTION public.complete_lottery_sync(
  _lottery_id uuid,
  _status text,
  _expected_contest_number integer,
  _expected_draw_at timestamptz,
  _next_attempt_at timestamptz,
  _success boolean,
  _error_type text DEFAULT NULL,
  _error_message text DEFAULT NULL,
  _next_action_kind text DEFAULT 'HEALTH_CHECK',
  _health_checked boolean DEFAULT false,
  _consistency_checked boolean DEFAULT false,
  _consistency_contest_number integer DEFAULT NULL
) RETURNS public.lottery_sync_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.lottery_sync_state%ROWTYPE;
BEGIN
  IF _status NOT IN ('UP_TO_DATE','WAITING_DRAW','WAITING_PUBLICATION','ATTENTION') THEN
    RAISE EXCEPTION 'invalid automation status';
  END IF;
  IF _next_action_kind NOT IN ('HEALTH_CHECK','PRE_DRAW_CHECK','WAIT_PUBLICATION','RETRY','CONSISTENCY_CHECK') THEN
    RAISE EXCEPTION 'invalid automation action';
  END IF;
  UPDATE public.lottery_sync_state
  SET status = _status,
      expected_contest_number = _expected_contest_number,
      expected_draw_at = _expected_draw_at,
      next_attempt_at = _next_attempt_at,
      next_action_kind = _next_action_kind,
      last_success_at = CASE WHEN _success THEN now() ELSE last_success_at END,
      last_health_check_at = CASE WHEN _health_checked THEN now() ELSE last_health_check_at END,
      last_consistency_check_at = CASE WHEN _consistency_checked THEN now() ELSE last_consistency_check_at END,
      consistency_contest_number = _consistency_contest_number,
      consecutive_failures = CASE WHEN _success THEN 0 ELSE consecutive_failures + 1 END,
      last_error_at = CASE WHEN _error_type IS NOT NULL THEN now() ELSE last_error_at END,
      last_error_type = _error_type,
      last_error_message = CASE WHEN _error_message IS NULL THEN NULL ELSE left(_error_message, 300) END,
      locked_at = NULL
  WHERE lottery_id = _lottery_id
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_lottery_sync(uuid, text, integer, timestamptz, timestamptz, boolean, text, text, text, boolean, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lottery_sync(uuid, text, integer, timestamptz, timestamptz, boolean, text, text, text, boolean, boolean, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_lottery_sync_scheduler()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE _request_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lottery_sync_state
    WHERE enabled AND (next_attempt_at IS NULL OR next_attempt_at <= now())
  ) AND NOT EXISTS (
    SELECT 1 FROM public.lottery_sync_jobs WHERE status IN ('pending','running')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.game_check_jobs WHERE status IN ('pending','running')
  ) THEN
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := c.endpoint,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || c.scheduler_token,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO _request_id
  FROM public.lottery_sync_scheduler_config c
  WHERE c.singleton AND c.enabled;
  RETURN _request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.invoke_lottery_sync_scheduler() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_lottery_sync_scheduler() TO service_role;

DO $$
DECLARE _existing bigint;
BEGIN
  SELECT jobid INTO _existing FROM cron.job WHERE jobname = 'gestor-da-sorte-lottery-sync';
  IF _existing IS NOT NULL THEN PERFORM cron.unschedule(_existing); END IF;
  PERFORM cron.schedule(
    'gestor-da-sorte-lottery-sync',
    '*/10 * * * *',
    'SELECT public.invoke_lottery_sync_scheduler();'
  );
END;
$$;

UPDATE public.lottery_sync_state
SET next_action_kind = CASE
      WHEN expected_draw_at IS NOT NULL AND expected_draw_at <= now() THEN 'WAIT_PUBLICATION'
      ELSE 'HEALTH_CHECK'
    END,
    next_attempt_at = CASE
      WHEN expected_draw_at IS NOT NULL AND expected_draw_at <= now() THEN now()
      ELSE LEAST(
        COALESCE(expected_draw_at - interval '45 minutes', now() + interval '6 hours'),
        now() + interval '6 hours'
      )
    END;