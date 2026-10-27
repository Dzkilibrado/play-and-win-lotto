-- Próximo sorteio de TODAS as modalidades, inclusive desabilitadas.
--
-- Até aqui a tela lia o próximo concurso do último RESULTADO salvo; modalidades
-- sem sincronização (Dupla Sena, Dia de Sorte, Timemania, +Milionária, Super
-- Sete) ficavam sem data ou com dado antigo. Esta tabela guarda só a
-- informação de calendário (concurso, data e prêmio estimado), atualizada por
-- uma consulta leve — não importa resultado nem confere jogo.
CREATE TABLE IF NOT EXISTS public.lottery_next_draw (
  lottery_id uuid PRIMARY KEY REFERENCES public.lotteries(id) ON DELETE CASCADE,
  contest_number integer,
  draw_date date,
  estimated_prize numeric,
  last_contest_number integer,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_error text
);

ALTER TABLE public.lottery_next_draw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lottery_next_draw_read" ON public.lottery_next_draw;
CREATE POLICY "lottery_next_draw_read" ON public.lottery_next_draw
  FOR SELECT TO authenticated, anon USING (true);

GRANT SELECT ON public.lottery_next_draw TO anon, authenticated;
GRANT ALL ON public.lottery_next_draw TO service_role;

-- O relógio do banco só chama o aplicativo quando há ação vencida. Passa a
-- considerar também o calendário do próximo sorteio (vencido, em falha ou
-- nunca consultado), para que isso valha para modalidades desabilitadas.
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
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.lotteries l
    LEFT JOIN public.lottery_next_draw n ON n.lottery_id = l.id
    WHERE n.lottery_id IS NULL
       OR (n.consecutive_failures > 0 AND n.last_attempt_at <= now() - interval '5 minutes')
       OR n.last_attempt_at <= now() - interval '6 hours'
       OR (n.draw_date IS NOT NULL
           AND n.draw_date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
           AND n.draw_date >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - 1
           AND n.last_attempt_at <= now() - interval '10 minutes')
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

-- Verificação (somente leitura): deve listar 0 linhas até a primeira execução.
-- SELECT count(*) FROM public.lottery_next_draw;
