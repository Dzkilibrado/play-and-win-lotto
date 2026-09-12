GRANT SELECT ON public.system_settings TO authenticated;

CREATE POLICY "system owner can read own designation"
ON public.system_settings
FOR SELECT
TO authenticated
USING (system_owner_user_id = auth.uid());