ALTER FUNCTION public.record_password_changed() SECURITY INVOKER;

GRANT INSERT ON public.audit_logs TO authenticated;

CREATE POLICY "audit own password change insert"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND entity_type = 'auth'
  AND entity_id = auth.uid()
  AND action = 'password_changed'
  AND metadata IS NULL
);