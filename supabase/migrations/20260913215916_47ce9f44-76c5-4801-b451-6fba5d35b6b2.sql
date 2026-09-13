UPDATE public.lottery_sync_state
SET expected_draw_at = CASE
      WHEN expected_draw_at IS NOT NULL
       AND EXTRACT(ISODOW FROM (expected_draw_at AT TIME ZONE 'America/Sao_Paulo')) = 7
      THEN (date_trunc('day', expected_draw_at AT TIME ZONE 'America/Sao_Paulo')
           + interval '11 hours') AT TIME ZONE 'America/Sao_Paulo'
      ELSE expected_draw_at
    END,
    next_attempt_at = CASE
      WHEN expected_draw_at IS NOT NULL
       AND EXTRACT(ISODOW FROM (expected_draw_at AT TIME ZONE 'America/Sao_Paulo')) = 7
       AND (next_attempt_at IS NULL OR next_attempt_at = expected_draw_at)
      THEN (date_trunc('day', expected_draw_at AT TIME ZONE 'America/Sao_Paulo')
           + interval '11 hours') AT TIME ZONE 'America/Sao_Paulo'
      ELSE next_attempt_at
    END,
    updated_at = now()
WHERE expected_draw_at IS NOT NULL
  AND EXTRACT(ISODOW FROM (expected_draw_at AT TIME ZONE 'America/Sao_Paulo')) = 7;