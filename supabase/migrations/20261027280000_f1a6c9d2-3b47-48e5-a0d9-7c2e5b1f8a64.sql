-- Tipos de acesso (SUPORTE) e permissões por módulo. Executar DEPOIS da migração 20261027270000.

CREATE TABLE IF NOT EXISTS public.access_permissions (
  role public.app_role NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, module),
  CONSTRAINT access_permissions_coerente CHECK (
    (can_create OR can_edit OR can_delete) IS NOT TRUE OR can_view
  )
);
ALTER TABLE public.access_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_permissions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.access_permissions TO service_role;

-- Módulos reconhecidos (mantido em sincronia com src/config/accessModules.ts).
CREATE OR REPLACE FUNCTION public.access_modules()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['usuarios','atendimento','monitor','loterias','atualizacao','conferencia','sistema','auditoria']
$$;

-- Padrão inicial do SUPORTE: consulta usuários e monitor; atende chamados.
INSERT INTO public.access_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  ('SUPORTE','usuarios',true,false,false,false),
  ('SUPORTE','atendimento',true,true,true,false),
  ('SUPORTE','monitor',true,false,false,false)
ON CONFLICT (role, module) DO NOTHING;

-- ADMIN tem acesso total sempre; os demais seguem a tabela.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'ADMIN')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.access_permissions ap ON ap.role = ur.role
      WHERE ur.user_id = _user_id AND ap.module = _module
        AND CASE _action
          WHEN 'view' THEN ap.can_view
          WHEN 'create' THEN ap.can_create
          WHEN 'edit' THEN ap.can_edit
          WHEN 'delete' THEN ap.can_delete
          ELSE false END
    )
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, service_role;

-- Permissões do próprio usuário (para a interface decidir o que mostrar).
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF public.has_role(v_uid, 'ADMIN') THEN
    RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('module', m, 'view', true, 'create', true, 'edit', true, 'delete', true)), '[]'::jsonb)
            FROM unnest(public.access_modules()) AS m);
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('module', g.module, 'view', g.v, 'create', g.c, 'edit', g.e, 'delete', g.d))
    FROM (
      SELECT ap.module, bool_or(ap.can_view) AS v, bool_or(ap.can_create) AS c, bool_or(ap.can_edit) AS e, bool_or(ap.can_delete) AS d
      FROM public.user_roles ur JOIN public.access_permissions ap ON ap.role = ur.role
      WHERE ur.user_id = v_uid
      GROUP BY ap.module
    ) g
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated, service_role;

-- Leitura da matriz de um tipo de acesso (somente ADMIN).
CREATE OR REPLACE FUNCTION public.admin_get_role_permissions(_actor uuid, _role public.app_role)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_actor, 'ADMIN') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'module', m,
      'view', coalesce(ap.can_view, false), 'create', coalesce(ap.can_create, false),
      'edit', coalesce(ap.can_edit, false), 'delete', coalesce(ap.can_delete, false)
    ) ORDER BY ord), '[]'::jsonb)
    FROM unnest(public.access_modules()) WITH ORDINALITY AS t(m, ord)
    LEFT JOIN public.access_permissions ap ON ap.role = _role AND ap.module = t.m
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_role_permissions(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_role_permissions(uuid, public.app_role) TO service_role;

-- Gravação da matriz do SUPORTE (ADMIN tem acesso total fixo; USER não tem módulos administrativos).
CREATE OR REPLACE FUNCTION public.admin_set_role_permissions(_actor uuid, _role public.app_role, _permissions jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_module text;
  v_view boolean; v_create boolean; v_edit boolean; v_delete boolean;
BEGIN
  IF NOT public.has_role(_actor, 'ADMIN') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  IF _role <> 'SUPORTE' THEN
    RAISE EXCEPTION 'Somente as permissões do Suporte podem ser editadas' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(_permissions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Permissões inválidas' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.access_permissions WHERE role = _role;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_permissions) LOOP
    v_module := v_item->>'module';
    IF v_module IS NULL OR NOT (v_module = ANY (public.access_modules())) THEN
      RAISE EXCEPTION 'Módulo inválido: %', coalesce(v_module, '(vazio)') USING ERRCODE = '22023';
    END IF;
    v_create := coalesce((v_item->>'create')::boolean, false);
    v_edit := coalesce((v_item->>'edit')::boolean, false);
    v_delete := coalesce((v_item->>'delete')::boolean, false);
    v_view := coalesce((v_item->>'view')::boolean, false) OR v_create OR v_edit OR v_delete;
    IF v_view THEN
      INSERT INTO public.access_permissions (role, module, can_view, can_create, can_edit, can_delete)
      VALUES (_role, v_module, true, v_create, v_edit, v_delete);
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (user_id, entity_type, entity_id, action, metadata)
  VALUES (_actor, 'ACCESS_TYPE', NULL, 'ROLE_PERMISSIONS_CHANGED', jsonb_build_object('role', _role::text, 'permissions', _permissions));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_role_permissions(uuid, public.app_role, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role_permissions(uuid, public.app_role, jsonb) TO service_role;

-- Troca do tipo de acesso de uma conta, de forma atômica e auditada.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _actor uuid, _target uuid, _role public.app_role, _reason text DEFAULT NULL, _details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_owner uuid;
  v_current public.app_role;
  v_other_admins integer;
BEGIN
  IF NOT public.has_role(_actor, 'ADMIN') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores' USING ERRCODE = '42501';
  END IF;
  IF _actor = _target THEN
    RAISE EXCEPTION 'Você não pode alterar o seu próprio tipo de acesso.' USING ERRCODE = '22023';
  END IF;
  IF _reason IS NOT NULL AND _reason NOT IN ('ADMIN_REQUEST','TEAM_CHANGE','SECURITY','OTHER') THEN
    RAISE EXCEPTION 'Motivo inválido' USING ERRCODE = '22023';
  END IF;
  IF _reason = 'OTHER' AND coalesce(btrim(_details), '') = '' THEN
    RAISE EXCEPTION 'Descreva o motivo.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target) THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = '22023';
  END IF;

  -- Serializa trocas de tipo de acesso para a regra do último administrador valer sob concorrência.
  PERFORM pg_advisory_xact_lock(hashtext('admin_set_user_role'));

  SELECT system_owner_user_id INTO v_owner FROM public.system_settings WHERE singleton = true;
  IF v_owner = _target THEN
    RAISE EXCEPTION 'O responsável principal não pode ter o tipo de acesso alterado.' USING ERRCODE = '22023';
  END IF;

  v_current := CASE
    WHEN public.has_role(_target, 'ADMIN') THEN 'ADMIN'::public.app_role
    WHEN public.has_role(_target, 'SUPORTE') THEN 'SUPORTE'::public.app_role
    ELSE 'USER'::public.app_role END;
  IF v_current = _role THEN
    RAISE EXCEPTION 'Esta conta já possui este tipo de acesso.' USING ERRCODE = '22023';
  END IF;

  IF v_current = 'ADMIN' THEN
    SELECT count(DISTINCT ur.user_id) INTO v_other_admins
    FROM public.user_roles ur JOIN auth.users u ON u.id = ur.user_id
    WHERE ur.role = 'ADMIN' AND ur.user_id <> _target
      AND (u.banned_until IS NULL OR u.banned_until <= now());
    IF v_other_admins < 1 THEN
      RAISE EXCEPTION 'O último administrador ativo não pode perder o acesso de administrador.' USING ERRCODE = '22023';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, _role);

  INSERT INTO public.audit_logs (user_id, entity_type, entity_id, action, metadata)
  VALUES (_actor, 'USER_ROLE', _target, 'USER_ROLE_CHANGED',
    jsonb_strip_nulls(jsonb_build_object('target_user_id', _target, 'from', v_current::text, 'to', _role::text, 'reason', _reason, 'reason_details', nullif(btrim(_details), ''))));

  RETURN jsonb_build_object('role', _role::text);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, uuid, public.app_role, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, uuid, public.app_role, text, text) TO service_role;

-- Listagem de usuários passa a reconhecer SUPORTE.
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
  v_owner_id uuid;
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

  SELECT system_owner_user_id INTO v_owner_id FROM public.system_settings WHERE singleton = true;

  WITH account_rows AS (
    SELECT u.id, coalesce(nullif(trim(p.display_name), ''), 'Usuário') AS display_name,
      CASE WHEN coalesce(position('@' in u.email), 0) > 1 THEN left(split_part(u.email, '@', 1), 1) || '***' || CASE WHEN length(split_part(u.email, '@', 1)) > 1 THEN right(split_part(u.email, '@', 1), 1) ELSE '' END || '@' || split_part(u.email, '@', 2) ELSE 'E-mail indisponível' END AS masked_email,
      CASE WHEN bool_or(ur.role = 'ADMIN') THEN 'ADMIN' WHEN bool_or(ur.role = 'SUPORTE') THEN 'SUPORTE' ELSE 'USER' END AS role,
      CASE WHEN u.banned_until IS NOT NULL AND u.banned_until > now() THEN 'BLOCKED' WHEN u.confirmed_at IS NULL THEN 'PENDING' ELSE 'ACTIVE' END AS account_status,
      coalesce((SELECT array_agg(DISTINCT i.provider ORDER BY i.provider) FROM auth.identities i WHERE i.user_id = u.id), ARRAY[]::text[]) AS providers,
      u.created_at, u.last_sign_in_at, u.id = v_owner_id AS is_system_owner
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    GROUP BY u.id, p.display_name, u.email, u.banned_until, u.confirmed_at, u.created_at, u.last_sign_in_at
  ), filtered AS (
    SELECT * FROM account_rows a WHERE (_status IS NULL OR a.account_status = _status) AND (_role IS NULL OR a.role = _role::text) AND (_provider IS NULL OR _provider = ANY(a.providers))
      AND (_created_period IS NULL OR (_created_period = 'TODAY' AND a.created_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') OR (_created_period = '7D' AND a.created_at >= now() - interval '7 days') OR (_created_period = '30D' AND a.created_at >= now() - interval '30 days') OR (_created_period = '90D' AND a.created_at >= now() - interval '90 days'))
      AND (_access_period IS NULL OR (_access_period = 'TODAY' AND a.last_sign_in_at >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') OR (_access_period = '7D' AND a.last_sign_in_at >= now() - interval '7 days') OR (_access_period = '30D' AND a.last_sign_in_at >= now() - interval '30 days') OR (_access_period = 'STALE' AND a.last_sign_in_at IS NOT NULL AND a.last_sign_in_at < now() - interval '30 days') OR (_access_period = 'NEVER' AND a.last_sign_in_at IS NULL))
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY CASE WHEN _sort = 'CREATED_DESC' THEN created_at END DESC NULLS LAST, CASE WHEN _sort = 'CREATED_ASC' THEN created_at END ASC NULLS LAST, CASE WHEN _sort = 'ACCESS_DESC' THEN last_sign_in_at END DESC NULLS LAST, CASE WHEN _sort = 'NAME_ASC' THEN lower(display_name) END ASC NULLS LAST, CASE WHEN _sort = 'NAME_DESC' THEN lower(display_name) END DESC NULLS LAST, created_at DESC, id LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
  ), summary AS (
    SELECT count(*)::integer AS total, count(*) FILTER (WHERE account_status = 'ACTIVE')::integer AS active, count(*) FILTER (WHERE account_status = 'PENDING')::integer AS pending, count(*) FILTER (WHERE account_status = 'BLOCKED')::integer AS blocked, count(*) FILTER (WHERE role = 'USER')::integer AS users, count(*) FILTER (WHERE role = 'SUPORTE')::integer AS support, count(*) FILTER (WHERE role = 'ADMIN')::integer AS admins FROM account_rows
  )
  SELECT jsonb_build_object('items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.display_name, 'email', r.masked_email, 'role', r.role, 'status', r.account_status, 'providers', r.providers, 'createdAt', r.created_at, 'lastAccessAt', r.last_sign_in_at, 'isSystemOwner', r.is_system_owner) ORDER BY CASE WHEN _sort = 'CREATED_DESC' THEN r.created_at END DESC NULLS LAST, CASE WHEN _sort = 'CREATED_ASC' THEN r.created_at END ASC NULLS LAST, CASE WHEN _sort = 'ACCESS_DESC' THEN r.last_sign_in_at END DESC NULLS LAST, CASE WHEN _sort = 'NAME_ASC' THEN lower(r.display_name) END ASC NULLS LAST, CASE WHEN _sort = 'NAME_DESC' THEN lower(r.display_name) END DESC NULLS LAST, r.created_at DESC) FROM page_rows r), '[]'::jsonb), 'total', (SELECT count(*)::integer FROM filtered), 'page', v_page, 'pageSize', v_page_size, 'summary', (SELECT to_jsonb(s) FROM summary s), 'availableProviders', coalesce((SELECT to_jsonb(array_agg(DISTINCT provider ORDER BY provider)) FROM account_rows, unnest(providers) AS provider), '[]'::jsonb)) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users_v2(uuid, integer, integer, text, public.app_role, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users_v2(uuid, integer, integer, text, public.app_role, text, text, text, text) TO service_role;