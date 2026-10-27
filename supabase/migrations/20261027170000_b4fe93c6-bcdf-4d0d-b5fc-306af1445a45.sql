-- ============================================================
-- Disponibilidade por modalidade (controle do administrador)
-- ============================================================
--   ENABLED     habilitada: tudo normal.
--   MAINTENANCE em manutenção: aparece com aviso, mas não aceita novos jogos/bolões.
--   DISABLED    desabilitada: some das listas e não aceita novos jogos/bolões.
-- Jogos, bolões e resultados que o usuário já tem continuam consultáveis.
-- A trava vale NO BANCO (gatilhos abaixo), não só na interface.
-- ============================================================

ALTER TABLE public.lotteries
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'ENABLED',
  ADD COLUMN IF NOT EXISTS availability_note text,
  ADD COLUMN IF NOT EXISTS availability_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS availability_changed_by uuid;

ALTER TABLE public.lotteries
  DROP CONSTRAINT IF EXISTS lotteries_availability_check;
ALTER TABLE public.lotteries
  ADD CONSTRAINT lotteries_availability_check
  CHECK (availability IN ('ENABLED', 'MAINTENANCE', 'DISABLED'));

-- Dupla Sena nasce DESABILITADA: a sincronização automática do 2º sorteio
-- ainda não foi validada com um payload real da fonte oficial. O
-- administrador habilita quando quiser, em Administração > Modalidades.
UPDATE public.lotteries
SET availability = 'DISABLED',
    availability_note = 'Aguardando validação da sincronização do 2º sorteio.',
    availability_changed_at = now()
WHERE slug = 'dupla-sena' AND availability = 'ENABLED' AND availability_changed_at IS NULL;

-- ---- trava no banco: sem jogo/bolão novo em modalidade indisponível ----
CREATE OR REPLACE FUNCTION public.guard_lottery_available()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _availability text;
BEGIN
  SELECT availability INTO _availability FROM public.lotteries WHERE id = NEW.lottery_id;
  IF _availability IS NOT NULL AND _availability <> 'ENABLED' THEN
    RAISE EXCEPTION 'Esta modalidade está indisponível no momento.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generated_games_lottery_available ON public.generated_games;
CREATE TRIGGER generated_games_lottery_available
BEFORE INSERT ON public.generated_games
FOR EACH ROW EXECUTE FUNCTION public.guard_lottery_available();

DROP TRIGGER IF EXISTS pools_lottery_available ON public.pools;
CREATE TRIGGER pools_lottery_available
BEFORE INSERT ON public.pools
FOR EACH ROW EXECUTE FUNCTION public.guard_lottery_available();

-- ---- alteração pelo administrador (com auditoria) ----
CREATE OR REPLACE FUNCTION public.admin_set_lottery_availability(
  _slug text,
  _status text,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lottery_id uuid;
  _previous text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'ADMIN') THEN
    RAISE EXCEPTION 'Ação restrita a administradores.' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('ENABLED', 'MAINTENANCE', 'DISABLED') THEN
    RAISE EXCEPTION 'Situação inválida: %', _status USING ERRCODE = '22023';
  END IF;

  SELECT id, availability INTO _lottery_id, _previous
  FROM public.lotteries WHERE slug = _slug FOR UPDATE;
  IF _lottery_id IS NULL THEN
    RAISE EXCEPTION 'Modalidade não encontrada: %', _slug USING ERRCODE = '22023';
  END IF;

  UPDATE public.lotteries
  SET availability = _status,
      availability_note = NULLIF(btrim(COALESCE(_note, '')), ''),
      availability_changed_at = now(),
      availability_changed_by = auth.uid()
  WHERE id = _lottery_id;

  INSERT INTO public.audit_logs (user_id, entity_type, entity_id, action, metadata)
  VALUES (
    auth.uid(), 'lottery', _lottery_id, 'LOTTERY_AVAILABILITY_CHANGED',
    jsonb_build_object('slug', _slug, 'from', _previous, 'to', _status,
                       'note', NULLIF(btrim(COALESCE(_note, '')), ''))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_lottery_availability(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_lottery_availability(text, text, text) TO authenticated;
