CREATE POLICY "pools owner read" ON public.pools
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);