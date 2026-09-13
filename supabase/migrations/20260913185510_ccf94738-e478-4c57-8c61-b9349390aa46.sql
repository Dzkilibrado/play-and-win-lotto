REVOKE EXECUTE ON FUNCTION public.pool_public_documents(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pool_public_documents(text) TO service_role;