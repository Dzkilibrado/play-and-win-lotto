CREATE TABLE public.lottery_sync_state (
  lottery_id uuid PRIMARY KEY REFERENCES public.lotteries(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'WAITING_DRAW' CHECK (status IN ('UP_TO_DATE','WAITING_DRAW','WAITING_PUBLICATION','SYNCING','ATTENTION')),
  expected_contest_number integer CHECK (expected_contest_number IS NULL OR expected_contest_number > 0),
  expected_draw_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  next_attempt_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error_type text,
  last_error_message text,
  locked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lottery_sync_state TO authenticated;
GRANT ALL ON public.lottery_sync_state TO service_role;
ALTER TABLE public.lottery_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync state admin read" ON public.lottery_sync_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE TRIGGER lottery_sync_state_updated_at BEFORE UPDATE ON public.lottery_sync_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lottery_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  contest_number integer,
  trigger_source text NOT NULL CHECK (trigger_source IN ('SCHEDULED','MANUAL')),
  status text NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','WAITING','FAILED')),
  outcome text,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  next_action_at timestamptz,
  error_type text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lottery_sync_runs TO authenticated;
GRANT ALL ON public.lottery_sync_runs TO service_role;
ALTER TABLE public.lottery_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync runs admin read" ON public.lottery_sync_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE INDEX lottery_sync_runs_recent_idx ON public.lottery_sync_runs (started_at DESC);
CREATE INDEX lottery_sync_runs_lottery_recent_idx ON public.lottery_sync_runs (lottery_id, started_at DESC);
CREATE INDEX lottery_sync_state_due_idx ON public.lottery_sync_state (next_attempt_at) WHERE enabled;

CREATE OR REPLACE FUNCTION public.claim_lottery_sync(
  _lottery_id uuid,
  _force boolean DEFAULT false,
  _stale_after interval DEFAULT interval '10 minutes'
) RETURNS public.lottery_sync_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.lottery_sync_state%ROWTYPE;
BEGIN
  UPDATE public.lottery_sync_state
  SET status = 'SYNCING',
      locked_at = now(),
      last_attempt_at = now()
  WHERE lottery_id = _lottery_id
    AND enabled
    AND (_force OR next_attempt_at IS NULL OR next_attempt_at <= now())
    AND (locked_at IS NULL OR locked_at < now() - _stale_after)
  RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_lottery_sync(uuid, boolean, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lottery_sync(uuid, boolean, interval) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_lottery_sync(
  _lottery_id uuid,
  _status text,
  _expected_contest_number integer,
  _expected_draw_at timestamptz,
  _next_attempt_at timestamptz,
  _success boolean,
  _error_type text DEFAULT NULL,
  _error_message text DEFAULT NULL
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
  UPDATE public.lottery_sync_state
  SET status = _status,
      expected_contest_number = _expected_contest_number,
      expected_draw_at = _expected_draw_at,
      next_attempt_at = _next_attempt_at,
      last_success_at = CASE WHEN _success THEN now() ELSE last_success_at END,
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
REVOKE ALL ON FUNCTION public.complete_lottery_sync(uuid, text, integer, timestamptz, timestamptz, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lottery_sync(uuid, text, integer, timestamptz, timestamptz, boolean, text, text) TO service_role;

INSERT INTO public.lottery_sync_state (
  lottery_id, status, expected_contest_number, expected_draw_at, next_attempt_at
)
SELECT l.id,
       CASE
         WHEN d.next_draw_date IS NULL THEN 'UP_TO_DATE'
         WHEN ((d.next_draw_date::text || ' 21:00 America/Sao_Paulo')::timestamptz) > now() THEN 'WAITING_DRAW'
         ELSE 'WAITING_PUBLICATION'
       END,
       d.next_contest_number,
       CASE WHEN d.next_draw_date IS NULL THEN NULL ELSE (d.next_draw_date::text || ' 21:00 America/Sao_Paulo')::timestamptz END,
       CASE
         WHEN d.next_draw_date IS NULL THEN now() + interval '12 hours'
         WHEN ((d.next_draw_date::text || ' 21:00 America/Sao_Paulo')::timestamptz) > now() THEN (d.next_draw_date::text || ' 21:00 America/Sao_Paulo')::timestamptz
         ELSE now()
       END
FROM public.lotteries l
LEFT JOIN LATERAL (
  SELECT next_contest_number, next_draw_date
  FROM public.lottery_draws
  WHERE lottery_id = l.id
  ORDER BY contest_number DESC
  LIMIT 1
) d ON true
WHERE l.is_active
ON CONFLICT (lottery_id) DO NOTHING;