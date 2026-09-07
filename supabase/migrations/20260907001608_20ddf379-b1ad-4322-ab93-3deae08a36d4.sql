REVOKE ALL ON FUNCTION public.set_game_sequence_number() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Users read own game imports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'game-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own game imports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'game-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own game imports"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'game-imports' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'game-imports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own game imports"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'game-imports' AND (storage.foldername(name))[1] = auth.uid()::text);