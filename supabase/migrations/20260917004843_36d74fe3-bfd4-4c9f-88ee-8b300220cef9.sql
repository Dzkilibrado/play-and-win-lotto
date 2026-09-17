CREATE OR REPLACE FUNCTION public.admin_list_users_v2(
  _requester_id uuid,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 20,
  _status text DEFAULT NULL,
  _role public.app_role DEFAULT NULL,
  _provider text DEFAULT NULL,
  _created_period text DEFAULT NULL,
  _access_period text DEFAULT NULL,
  _sort text DEFAULT 'CREATED_DESC'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_page integer := greatest(coalesce(_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(_page_size, 20), 1), 100);
  v_result jsonb;
BEGIN
  IF NOT public.has_role(_requester_id, 'ADMIN') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('ACTIVE', 'PENDING', 'BLOCKED') THEN RAISE EXCEPTION 'Filtro de status inválido' USING ERRCODE = '22023'; END IF;
  IF _provider IS NOT NULL AND _provider NOT IN ('email', 'google') THEN RAISE EXCEPTION 'Filtro de acesso inválido' USING ERRCODE = '22023'; END IF;
  IF _created_period IS NOT NULL AND _created_period NOT IN ('TODAY', '7D', '30D', '90D') THEN RAISE EXCEPTION 'Filtro de cadastro inválido' USING ERRCODE = '22023'; END IF;
  IF _access_period IS NOT NULL AND _access_period NOT IN ('TODAY', '7D', '30D', 'STALE', 'NEVER') THEN RAISE EXCEPTION 'Filtro de último acesso inválido' USING ERRCODE = '22023'; END IF;
  IF _sort NOT IN ('CREATED_DESC', 'CREATED_ASC', 'ACCESS_DESC', 'NAME_ASC', 'NAME_DESC') THEN RAISE EXCEPTION 'Ordenação inválida' USING ERRCODE = '22023'; END IF;

  WITH account_rows AS (
    SELECT u.id, coalesce(nullif(trim(p.display_name), ''), 'Usuário') AS display_name,
      CASE WHEN coalesce(position('@' in u.email), 0) > 1 THEN left(split_part(u.email, '@', 1), 1) || '***' || CASE WHEN length(split_part(u.email, '@', 1)) > 1 THEN right(split_part(u.email, '@', 1), 1) ELSE '' END || '@' || split_part(u.email, '@', 2) ELSE 'E-mail indisponível' END AS masked_email,
      CASE WHEN bool_or(ur.role = 'ADMIN') THEN 'ADMIN' ELSE 'USER' END AS role,
      CASE WHEN u.banned_until IS NOT NULL AND u.banned_until > now() THEN 'BLOCKED' WHEN u.confirmed_at IS NULL THEN 'PENDING' ELSE 'ACTIVE' END AS account_status,
      coalesce((SELECT array_agg(DISTINCT i.provider ORDER BY i.provider) FROM auth.identities i WHERE i.user_id = u.id), ARRAY[]::text[]) AS providers,
      u.created_at, u.last_sign_in_at
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    GROUP BY u.id, p.display_name, u.email, u.banned_until, u.confirmed_at, u.created_at, u.last_sign_in_at
  ), filtered AS (
    SELECT * FROM account_rows a WHERE (_status IS NULL OR a.account_status = _status) AND (_role IS NULL OR a.role = _role::text) AND (_provider IS NULL OR _provider = ANY(a.providers))
      AND (_created_period IS NULL OR (_created_period = 'TODAY' AND a.created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') OR (_created_period = '7D' AND a.created_at >= now() - interval '7 days') OR (_created_period = '30D' AND a.created_at >= now() - interval '30 days') OR (_created_period = '90D' AND a.created_at >= now() - interval '90 days'))
      AND (_access_period IS NULL OR (_access_period = 'TODAY' AND a.last_sign_in_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') OR (_access_period = '7D' AND a.last_sign_in_at >= now() - interval '7 days') OR (_access_period = '30D' AND a.last_sign_in_at >= now() - interval '30 days') OR (_access_period = 'STALE' AND a.last_sign_in_at IS NOT NULL AND a.last_sign_in_at < now() - interval '30 days') OR (_access_period = 'NEVER' AND a.last_sign_in_at IS NULL))
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY CASE WHEN _sort = 'CREATED_DESC' THEN created_at END DESC NULLS LAST, CASE WHEN _sort = 'CREATED_ASC' THEN created_at END ASC NULLS LAST, CASE WHEN _sort = 'ACCESS_DESC' THEN last_sign_in_at END DESC NULLS LAST, CASE WHEN _sort = 'NAME_ASC' THEN lower(display_name) END ASC NULLS LAST, CASE WHEN _sort = 'NAME_DESC' THEN lower(display_name) END DESC NULLS LAST, created_at DESC, id LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
  ), summary AS (
    SELECT count(*)::integer AS total, count(*) FILTER (WHERE account_status = 'ACTIVE')::integer AS active, count(*) FILTER (WHERE account_status = 'PENDING')::integer AS pending, count(*) FILTER (WHERE account_status = 'BLOCKED')::integer AS blocked, count(*) FILTER (WHERE role = 'USER')::integer AS users, count(*) FILTER (WHERE role = 'ADMIN')::integer AS admins FROM account_rows
  )
  SELECT jsonb_build_object('items', coalesce((SELECT jsonb_agg(jsonb_build_object('name', r.display_name, 'email', r.masked_email, 'role', r.role, 'status', r.account_status, 'providers', r.providers, 'createdAt', r.created_at, 'lastAccessAt', r.last_sign_in_at) ORDER BY CASE WHEN _sort = 'CREATED_DESC' THEN r.created_at END DESC NULLS LAST, CASE WHEN _sort = 'CREATED_ASC' THEN r.created_at END ASC NULLS LAST, CASE WHEN _sort = 'ACCESS_DESC' THEN r.last_sign_in_at END DESC NULLS LAST, CASE WHEN _sort = 'NAME_ASC' THEN lower(r.display_name) END ASC NULLS LAST, CASE WHEN _sort = 'NAME_DESC' THEN lower(r.display_name) END DESC NULLS LAST, r.created_at DESC) FROM page_rows r), '[]'::jsonb), 'total', (SELECT count(*)::integer FROM filtered), 'page', v_page, 'pageSize', v_page_size, 'summary', (SELECT to_jsonb(s) FROM summary s), 'availableProviders', coalesce((SELECT to_jsonb(array_agg(DISTINCT provider ORDER BY provider)) FROM account_rows, unnest(providers) AS provider), '[]'::jsonb)) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users_v2(uuid, integer, integer, text, public.app_role, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users_v2(uuid, integer, integer, text, public.app_role, text, text, text, text) TO service_role;