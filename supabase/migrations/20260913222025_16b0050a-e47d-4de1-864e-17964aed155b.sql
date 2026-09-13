UPDATE public.lottery_sync_state
SET status = 'WAITING_PUBLICATION'
WHERE enabled
  AND expected_draw_at IS NOT NULL
  AND expected_draw_at <= now()
  AND status = 'WAITING_DRAW';