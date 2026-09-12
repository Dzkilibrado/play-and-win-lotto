CREATE TABLE public.system_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  system_owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

GRANT ALL ON public.system_settings TO service_role;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.system_settings IS 'Configuração institucional interna do Gestor da Sorte.';
COMMENT ON COLUMN public.system_settings.system_owner_user_id IS 'Responsável administrativo principal, separado das permissões em user_roles.';

REVOKE ALL ON public.system_settings FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;