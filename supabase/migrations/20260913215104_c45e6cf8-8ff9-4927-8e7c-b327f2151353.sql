-- lovable-cron-fallback-reviewed: 96 runs/day; a fonte oficial CAIXA nao oferece webhook e o requisito limita o atraso de atualizacao a 15 minutos
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE public.lottery_sync_scheduler_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  endpoint text NOT NULL,
  token_hash text NOT NULL,
  scheduler_token text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lottery_sync_scheduler_config TO service_role;
ALTER TABLE public.lottery_sync_scheduler_config ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER lottery_sync_scheduler_config_updated_at
BEFORE UPDATE ON public.lottery_sync_scheduler_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.verify_sync_scheduler_token(_token text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lottery_sync_scheduler_config c
    WHERE c.singleton
      AND c.enabled
      AND c.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
  );
$$;
REVOKE ALL ON FUNCTION public.verify_sync_scheduler_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sync_scheduler_token(text) TO service_role;

DO $$
DECLARE
  _token text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  INSERT INTO public.lottery_sync_scheduler_config (
    singleton,
    endpoint,
    token_hash,
    scheduler_token,
    enabled
  ) VALUES (
    true,
    'https://www.gestordasorte.com.br/api/public/sync/run',
    encode(extensions.digest(_token, 'sha256'), 'hex'),
    _token,
    true
  )
  ON CONFLICT (singleton) DO UPDATE SET
    endpoint = EXCLUDED.endpoint,
    token_hash = EXCLUDED.token_hash,
    scheduler_token = EXCLUDED.scheduler_token,
    enabled = true,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.invoke_lottery_sync_scheduler()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _request_id bigint;
BEGIN
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
DECLARE
  _existing bigint;
BEGIN
  SELECT jobid INTO _existing FROM cron.job WHERE jobname = 'gestor-da-sorte-lottery-sync';
  IF _existing IS NOT NULL THEN
    PERFORM cron.unschedule(_existing);
  END IF;
  PERFORM cron.schedule(
    'gestor-da-sorte-lottery-sync',
    '*/15 * * * *',
    'SELECT public.invoke_lottery_sync_scheduler();'
  );
END;
$$;