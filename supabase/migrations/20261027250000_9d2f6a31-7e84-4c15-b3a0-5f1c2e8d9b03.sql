-- Modo manutenção geral.
--
-- Um único interruptor do administrador, com valor no banco (não só na tela):
--  * a interface mostra uma tela de manutenção a todos, exceto administradores;
--  * o banco recusa jogos e bolões novos de quem não é administrador.
-- Jogos, bolões e resultados já existentes não são tocados. Ligar e desligar
-- ficam registrados na auditoria.
CREATE TABLE IF NOT EXISTS public.system_maintenance (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_reason text,
  maintenance_changed_at timestamptz,
  maintenance_changed_by uuid
);

INSERT INTO public.system_maintenance (singleton) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.system_maintenance ENABLE ROW LEVEL SECURITY;
-- Nenhuma política: o acesso é só pelas funções abaixo.
REVOKE ALL ON public.system_maintenance FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.system_maintenance TO service_role;

-- Leitura pública mínima (a tela de login e o aplicativo precisam saber).
CREATE OR REPLACE FUNCTION public.get_system_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'maintenance', COALESCE(maintenance_enabled, false),
    'reason', maintenance_reason,
    'changed_at', maintenance_changed_at
  )
  FROM public.system_maintenance WHERE singleton;
$$;
REVOKE ALL ON FUNCTION public.get_system_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_system_status() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_maintenance(_enabled boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _previous boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Ação restrita a administradores.' USING ERRCODE = '42501';
  END IF;

  SELECT maintenance_enabled INTO _previous FROM public.system_maintenance WHERE singleton FOR UPDATE;

  UPDATE public.system_maintenance
  SET maintenance_enabled = _enabled,
      maintenance_reason = CASE WHEN _enabled THEN NULLIF(btrim(COALESCE(_reason, '')), '') ELSE NULL END,
      maintenance_changed_at = now(),
      maintenance_changed_by = auth.uid()
  WHERE singleton;

  INSERT INTO public.audit_logs (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'system', NULL, 'SYSTEM_MAINTENANCE_CHANGED',
    jsonb_build_object('from', _previous, 'to', _enabled,
                       'reason', NULLIF(btrim(COALESCE(_reason, '')), ''))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_maintenance(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_maintenance(boolean, text) TO authenticated;

-- A trava de modalidade passa a considerar também o modo manutenção geral.
CREATE OR REPLACE FUNCTION public.guard_lottery_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _availability text;
  _maintenance boolean;
BEGIN
  SELECT maintenance_enabled INTO _maintenance FROM public.system_maintenance WHERE singleton;
  IF COALESCE(_maintenance, false)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'O sistema está em manutenção no momento.' USING ERRCODE = '23514';
  END IF;

  SELECT availability INTO _availability FROM public.lotteries WHERE id = NEW.lottery_id;
  IF _availability IS NOT NULL AND _availability <> 'ENABLED' THEN
    RAISE EXCEPTION 'Esta modalidade está indisponível no momento.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Verificação (somente leitura): deve retornar {"maintenance": false, ...}
-- SELECT public.get_system_status();
