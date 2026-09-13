CREATE POLICY "scheduler config denied to clients"
ON public.lottery_sync_scheduler_config
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);