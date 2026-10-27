-- Monitor da Administração: preferências por usuário e leitura dos indicadores.
--
-- Cada administrador escolhe quais indicadores aparecem no Monitor e em que
-- ordem. Os valores vêm de uma única função (somente ADMIN), que apenas lê
-- tabelas existentes — nada é alterado.
CREATE TABLE IF NOT EXISTS public.admin_monitor_prefs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 60),
  enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);

ALTER TABLE public.admin_monitor_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monitor prefs owner admin" ON public.admin_monitor_prefs;
CREATE POLICY "monitor prefs owner admin" ON public.admin_monitor_prefs
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'ADMIN'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_monitor_prefs TO authenticated;
GRANT ALL ON public.admin_monitor_prefs TO service_role;

CREATE OR REPLACE FUNCTION public.admin_monitor_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'sync_attention', (SELECT count(*) FROM public.lottery_sync_state WHERE enabled AND status = 'ATTENTION'),
    'sync_late', (SELECT count(*) FROM public.lottery_sync_state
                   WHERE enabled AND status = 'WAITING_PUBLICATION'
                     AND expected_draw_at < now() - interval '3 hours'),
    'sync_max_failures', (SELECT COALESCE(max(consecutive_failures), 0) FROM public.lottery_sync_state WHERE enabled),
    'sync_last_success', (SELECT min(last_success_at) FROM public.lottery_sync_state WHERE enabled),
    'next_draw_failures', (SELECT count(*) FROM public.lottery_next_draw WHERE consecutive_failures > 0),
    'check_failed_jobs', (SELECT count(*) FROM public.game_check_jobs WHERE status = 'failed' OR failed > 0),
    'check_queue', (SELECT count(*) FROM public.game_check_jobs WHERE status IN ('pending','running')),
    'lotteries_maintenance', (SELECT count(*) FROM public.lotteries WHERE is_active AND availability = 'MAINTENANCE'),
    'lotteries_disabled', (SELECT count(*) FROM public.lotteries WHERE is_active AND availability = 'DISABLED'),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'generated_at', now()
  ) INTO _result;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_monitor_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_monitor_snapshot() TO authenticated;

-- Verificação (somente leitura; precisa de sessão de administrador, então no
-- editor SQL use a consulta abaixo, que não depende de login):
-- SELECT count(*) FROM public.admin_monitor_prefs;
