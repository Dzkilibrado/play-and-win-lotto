-- ============================================================
-- FASE 5 — Bolões completos
-- ============================================================

ALTER TYPE public.pool_status ADD VALUE IF NOT EXISTS 'AWAITING_CHECK' AFTER 'AWAITING_DRAW';
ALTER TYPE public.pool_status ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE public.participant_status AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE public.distribution_status AS ENUM ('CALCULATED', 'CONFIRMED', 'OUTDATED');

-- ------------------------------------------------------------
-- pools: concurso planejado, ciclo de vida e link público
-- ------------------------------------------------------------
ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS contest_number_planned integer,
  ADD COLUMN IF NOT EXISTS draw_date_planned date,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_token text;

CREATE UNIQUE INDEX IF NOT EXISTS pools_public_token_key ON public.pools (public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS pools_lottery_contest_idx ON public.pools (lottery_id, contest_number);

-- ------------------------------------------------------------
-- participantes
-- ------------------------------------------------------------
ALTER TABLE public.pool_participants
  ADD COLUMN IF NOT EXISTS status public.participant_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS amount_adjustment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_reason text,
  ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eligible_for_prize_share boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ineligible_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS pool_participants_pool_idx ON public.pool_participants (pool_id, payment_status);

-- ------------------------------------------------------------
-- pagamentos
-- ------------------------------------------------------------
ALTER TABLE public.pool_payments
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS pool_payments_participant_idx ON public.pool_payments (participant_id);

-- ------------------------------------------------------------
-- jogos do bolão: um jogo pertence a no máximo um bolão
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS pool_games_game_unique ON public.pool_games (game_id);

CREATE OR REPLACE FUNCTION public.validate_pool_game()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pool pools%ROWTYPE;
  _game generated_games%ROWTYPE;
  _pool_contest integer;
BEGIN
  SELECT * INTO _pool FROM pools WHERE id = NEW.pool_id;
  SELECT * INTO _game FROM generated_games WHERE id = NEW.game_id;
  IF _pool.id IS NULL OR _game.id IS NULL THEN
    RAISE EXCEPTION 'Bolão ou jogo inexistente.' USING ERRCODE = '23503';
  END IF;
  IF _pool.lottery_id <> _game.lottery_id THEN
    RAISE EXCEPTION 'O jogo é de outra modalidade e não pode entrar neste bolão.' USING ERRCODE = '23514';
  END IF;
  _pool_contest := COALESCE(_pool.contest_number, _pool.contest_number_planned);
  IF _game.contest_number IS NOT NULL AND _pool_contest IS NOT NULL
     AND _game.contest_number <> _pool_contest THEN
    RAISE EXCEPTION 'O jogo é de outro concurso e não pode entrar neste bolão.' USING ERRCODE = '23514';
  END IF;
  IF _pool.status IN ('CANCELLED','FINISHED') THEN
    RAISE EXCEPTION 'Este bolão não aceita novos jogos.' USING ERRCODE = '23514';
  END IF;
  UPDATE generated_games
     SET pool_id = NEW.pool_id,
         contest_number = COALESCE(contest_number, _pool_contest)
   WHERE id = NEW.game_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pool_games_validate ON public.pool_games;
CREATE TRIGGER pool_games_validate BEFORE INSERT ON public.pool_games
FOR EACH ROW EXECUTE FUNCTION public.validate_pool_game();

CREATE OR REPLACE FUNCTION public.unlink_pool_game()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE generated_games SET pool_id = NULL WHERE id = OLD.game_id AND pool_id = OLD.pool_id;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS pool_games_unlink ON public.pool_games;
CREATE TRIGGER pool_games_unlink AFTER DELETE ON public.pool_games
FOR EACH ROW EXECUTE FUNCTION public.unlink_pool_game();

-- ------------------------------------------------------------
-- histórico do bolão
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pool_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pool_events_pool_idx ON public.pool_events (pool_id, created_at DESC);

GRANT SELECT ON public.pool_events TO authenticated;
GRANT ALL ON public.pool_events TO service_role;
ALTER TABLE public.pool_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool events read" ON public.pool_events FOR SELECT TO authenticated
  USING (public.is_pool_member(pool_id));

-- ------------------------------------------------------------
-- rateio
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pool_prize_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  version integer NOT NULL,
  total_prize numeric NOT NULL DEFAULT 0,
  rateable_prize numeric NOT NULL DEFAULT 0,
  total_eligible_quotas integer NOT NULL DEFAULT 0,
  value_per_quota numeric NOT NULL DEFAULT 0,
  rounding_remainder numeric NOT NULL DEFAULT 0,
  status public.distribution_status NOT NULL DEFAULT 'CALCULATED',
  calculation_version integer NOT NULL DEFAULT 1,
  source_hash text NOT NULL,
  calculated_by uuid,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, version)
);
CREATE INDEX IF NOT EXISTS pool_prize_distributions_pool_idx ON public.pool_prize_distributions (pool_id, version DESC);

GRANT SELECT ON public.pool_prize_distributions TO authenticated;
GRANT ALL ON public.pool_prize_distributions TO service_role;
ALTER TABLE public.pool_prize_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "distribution read" ON public.pool_prize_distributions FOR SELECT TO authenticated
  USING (public.is_pool_member(pool_id));

CREATE TRIGGER pool_prize_distributions_updated_at BEFORE UPDATE ON public.pool_prize_distributions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pool_prize_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES public.pool_prize_distributions(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.pool_participants(id) ON DELETE CASCADE,
  eligible_quotas integer NOT NULL,
  share_amount numeric NOT NULL,
  rounding_adjustment numeric NOT NULL DEFAULT 0,
  payment_status_at_calc public.payment_status NOT NULL,
  status text NOT NULL DEFAULT 'TO_RECEIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distribution_id, participant_id)
);
CREATE INDEX IF NOT EXISTS pool_prize_participants_dist_idx ON public.pool_prize_participants (distribution_id);

GRANT SELECT ON public.pool_prize_participants TO authenticated;
GRANT ALL ON public.pool_prize_participants TO service_role;
ALTER TABLE public.pool_prize_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "distribution participants read" ON public.pool_prize_participants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pool_prize_distributions d
    WHERE d.id = distribution_id AND public.is_pool_member(d.pool_id)
  ));

-- ------------------------------------------------------------
-- histórico interno + auditoria
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_pool_event(
  _pool_id uuid, _event_type text, _description text, _metadata jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO pool_events (pool_id, actor_id, event_type, description, metadata)
  VALUES (_pool_id, auth.uid(), _event_type, _description, _metadata);
  INSERT INTO audit_logs (user_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), 'pool', _pool_id, _event_type, _metadata);
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_pool_event(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- situação de pagamento derivada
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalc_participant_payment(_participant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p pool_participants%ROWTYPE;
  _due numeric;
  _paid numeric;
  _deadline date;
  _status payment_status;
  _last timestamptz;
BEGIN
  SELECT * INTO _p FROM pool_participants WHERE id = _participant_id;
  IF _p.id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0), MAX(paid_at) INTO _paid, _last
    FROM pool_payments WHERE participant_id = _participant_id AND cancelled_at IS NULL;
  SELECT payment_deadline INTO _deadline FROM pools WHERE id = _p.pool_id;

  _due := GREATEST(COALESCE(_p.amount_due, 0), 0);

  IF _p.status = 'CANCELLED' THEN
    _status := 'CANCELLED';
  ELSIF _paid >= _due AND _due > 0 THEN
    _status := 'PAID';
  ELSIF _paid > 0 THEN
    _status := CASE WHEN _deadline IS NOT NULL AND _deadline < current_date THEN 'OVERDUE' ELSE 'PARTIAL' END;
  ELSE
    _status := CASE WHEN _deadline IS NOT NULL AND _deadline < current_date THEN 'OVERDUE' ELSE 'PENDING' END;
  END IF;

  UPDATE pool_participants
     SET total_paid = _paid,
         payment_status = _status,
         paid_at = CASE WHEN _status = 'PAID' THEN _last ELSE NULL END
   WHERE id = _participant_id;
END; $$;

CREATE OR REPLACE FUNCTION public.pool_payments_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_participant_payment(COALESCE(NEW.participant_id, OLD.participant_id));
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS pool_payments_sync_trg ON public.pool_payments;
CREATE TRIGGER pool_payments_sync_trg AFTER INSERT OR UPDATE OR DELETE ON public.pool_payments
FOR EACH ROW EXECUTE FUNCTION public.pool_payments_sync();

-- valor devido padrão = cotas x valor da cota + ajuste explícito
CREATE OR REPLACE FUNCTION public.pool_participant_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _quota numeric;
BEGIN
  SELECT quota_value INTO _quota FROM pools WHERE id = NEW.pool_id;
  NEW.amount_due := GREATEST(COALESCE(_quota, 0) * GREATEST(COALESCE(NEW.quotas, 0), 0) + COALESCE(NEW.amount_adjustment, 0), 0);
  IF COALESCE(NEW.amount_adjustment, 0) <> 0 AND COALESCE(NEW.adjustment_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste de valor.' USING ERRCODE = '23514';
  END IF;
  IF NEW.eligible_for_prize_share = false AND COALESCE(NEW.ineligible_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo para retirar o participante do rateio.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pool_participant_defaults_trg ON public.pool_participants;
CREATE TRIGGER pool_participant_defaults_trg BEFORE INSERT OR UPDATE ON public.pool_participants
FOR EACH ROW EXECUTE FUNCTION public.pool_participant_defaults();

CREATE OR REPLACE FUNCTION public.pool_participant_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_participant_payment(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pool_participant_after_trg ON public.pool_participants;
CREATE TRIGGER pool_participant_after_trg AFTER INSERT ON public.pool_participants
FOR EACH ROW EXECUTE FUNCTION public.pool_participant_after();

-- ------------------------------------------------------------
-- pagamentos: validação no servidor
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pool_register_payment(
  _participant_id uuid, _amount numeric, _paid_at timestamptz DEFAULT now(),
  _method text DEFAULT NULL, _notes text DEFAULT NULL, _allow_overpay boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p pool_participants%ROWTYPE;
  _paid numeric;
  _id uuid;
BEGIN
  SELECT * INTO _p FROM pool_participants WHERE id = _participant_id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Participante não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_p.pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador registra pagamentos.' USING ERRCODE = '42501';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero.' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _paid FROM pool_payments
   WHERE participant_id = _participant_id AND cancelled_at IS NULL;

  IF _paid + _amount > _p.amount_due AND NOT _allow_overpay THEN
    RAISE EXCEPTION 'Valor acima do devido: confirme o excedente para continuar.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO pool_payments (pool_id, participant_id, amount, paid_at, method, notes, created_by)
  VALUES (_p.pool_id, _participant_id, _amount, _paid_at, _method, _notes, auth.uid())
  RETURNING id INTO _id;

  PERFORM public.log_pool_event(_p.pool_id, 'payment_registered',
    'Pagamento registrado para ' || _p.name,
    jsonb_build_object('participant', _p.name, 'amount', _amount, 'overpay', (_paid + _amount) > _p.amount_due));
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.pool_cancel_payment(_payment_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pay pool_payments%ROWTYPE;
BEGIN
  SELECT * INTO _pay FROM pool_payments WHERE id = _payment_id FOR UPDATE;
  IF _pay.id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_pay.pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera pagamentos.' USING ERRCODE = '42501';
  END IF;
  UPDATE pool_payments SET cancelled_at = now(), notes = COALESCE(_reason, notes) WHERE id = _payment_id;
  PERFORM public.recalc_participant_payment(_pay.participant_id);
  PERFORM public.log_pool_event(_pay.pool_id, 'payment_cancelled', 'Pagamento corrigido/removido',
    jsonb_build_object('amount', _pay.amount, 'reason', _reason));
END; $$;

-- ------------------------------------------------------------
-- elegibilidade ao rateio
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pool_set_participant_eligibility(
  _participant_id uuid, _eligible boolean, _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p pool_participants%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM pool_participants WHERE id = _participant_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Participante não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_p.pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera o rateio.' USING ERRCODE = '42501';
  END IF;
  IF _eligible = false AND COALESCE(_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo para retirar o participante do rateio.' USING ERRCODE = '23514';
  END IF;
  UPDATE pool_participants
     SET eligible_for_prize_share = _eligible,
         ineligible_reason = CASE WHEN _eligible THEN NULL ELSE _reason END
   WHERE id = _participant_id;
  UPDATE pool_prize_distributions SET status = 'OUTDATED'
   WHERE pool_id = _p.pool_id AND status <> 'CONFIRMED';
  PERFORM public.log_pool_event(_p.pool_id, 'participant_eligibility',
    CASE WHEN _eligible THEN _p.name || ' voltou a participar do rateio'
         ELSE _p.name || ' foi retirado do rateio' END,
    jsonb_build_object('participant', _p.name, 'reason', _reason));
END; $$;

CREATE OR REPLACE FUNCTION public.pool_cancel_participant(_participant_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p pool_participants%ROWTYPE;
BEGIN
  SELECT * INTO _p FROM pool_participants WHERE id = _participant_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Participante não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_p.pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera participantes.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento.' USING ERRCODE = '23514';
  END IF;
  UPDATE pool_participants
     SET status = 'CANCELLED', cancelled_at = now(), eligible_for_prize_share = false,
         ineligible_reason = _reason, notes = COALESCE(notes, '')
   WHERE id = _participant_id;
  PERFORM public.recalc_participant_payment(_participant_id);
  PERFORM public.log_pool_event(_p.pool_id, 'participant_cancelled',
    _p.name || ' foi cancelado', jsonb_build_object('participant', _p.name, 'reason', _reason));
END; $$;

-- ------------------------------------------------------------
-- ciclo de vida do bolão
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pool_set_status(_pool_id uuid, _status public.pool_status, _reason text DEFAULT NULL)
RETURNS public.pool_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pool pools%ROWTYPE;
  _allowed pool_status[];
BEGIN
  SELECT * INTO _pool FROM pools WHERE id = _pool_id FOR UPDATE;
  IF _pool.id IS NULL THEN RAISE EXCEPTION 'Bolão não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera a situação.' USING ERRCODE = '42501';
  END IF;

  _allowed := CASE _pool.status
    WHEN 'FORMING' THEN ARRAY['OPEN','CANCELLED']::pool_status[]
    WHEN 'OPEN' THEN ARRAY['CLOSED','CANCELLED']::pool_status[]
    WHEN 'CLOSED' THEN ARRAY['AWAITING_DRAW','OPEN','CANCELLED']::pool_status[]
    WHEN 'AWAITING_DRAW' THEN ARRAY['AWAITING_CHECK','CLOSED','CANCELLED']::pool_status[]
    WHEN 'AWAITING_CHECK' THEN ARRAY['CHECKED','PRIZED']::pool_status[]
    WHEN 'CHECKED' THEN ARRAY['PRIZED','FINISHED']::pool_status[]
    WHEN 'PRIZED' THEN ARRAY['FINISHED']::pool_status[]
    ELSE ARRAY[]::pool_status[]
  END;

  IF NOT (_status = ANY(_allowed)) THEN
    RAISE EXCEPTION 'Esta mudança de situação não é permitida a partir da situação atual.' USING ERRCODE = '23514';
  END IF;
  IF _status = 'CANCELLED' AND COALESCE(_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento.' USING ERRCODE = '23514';
  END IF;

  UPDATE pools SET
    status = _status,
    closed_at = CASE WHEN _status = 'CLOSED' THEN now() ELSE closed_at END,
    reopened_at = CASE WHEN _status = 'OPEN' AND _pool.status = 'CLOSED' THEN now() ELSE reopened_at END,
    cancelled_at = CASE WHEN _status = 'CANCELLED' THEN now() ELSE cancelled_at END,
    cancel_reason = CASE WHEN _status = 'CANCELLED' THEN _reason ELSE cancel_reason END
  WHERE id = _pool_id;

  PERFORM public.log_pool_event(_pool_id, 'status_changed',
    'Situação alterada para ' || _status::text, jsonb_build_object('from', _pool.status, 'to', _status, 'reason', _reason));
  RETURN _status;
END; $$;

-- link público
CREATE OR REPLACE FUNCTION public.pool_set_public(_pool_id uuid, _enabled boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _token text;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera o link público.' USING ERRCODE = '42501';
  END IF;
  IF _enabled THEN
    _token := encode(gen_random_bytes(16), 'hex');
    UPDATE pools SET is_public = true, public_token = _token WHERE id = _pool_id;
    PERFORM public.log_pool_event(_pool_id, 'public_link_enabled', 'Link público ativado', NULL);
  ELSE
    UPDATE pools SET is_public = false, public_token = NULL WHERE id = _pool_id;
    PERFORM public.log_pool_event(_pool_id, 'public_link_revoked', 'Link público revogado', NULL);
    _token := NULL;
  END IF;
  RETURN _token;
END; $$;

-- resumo público (somente dados autorizados)
CREATE OR REPLACE FUNCTION public.pool_public_summary(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'name', p.name,
    'lottery', l.name,
    'lotterySlug', l.slug,
    'contestNumber', COALESCE(p.contest_number, p.contest_number_planned),
    'drawDate', COALESCE(p.draw_date, p.draw_date_planned),
    'drawDatePlanned', (p.draw_date IS NULL),
    'status', p.status,
    'totalQuotas', p.total_quotas,
    'takenQuotas', COALESCE((SELECT SUM(quotas) FROM pool_participants pp WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE'), 0),
    'participants', COALESCE((SELECT COUNT(*) FROM pool_participants pp WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE'), 0),
    'games', COALESCE((SELECT COUNT(*) FROM pool_games pg WHERE pg.pool_id = p.id), 0),
    'quotaValue', p.quota_value
  )
  FROM pools p JOIN lotteries l ON l.id = p.lottery_id
  WHERE p.public_token = _token AND p.is_public = true;
$$;
GRANT EXECUTE ON FUNCTION public.pool_public_summary(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- premiação e rateio
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pool_prize_total(_pool_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(r.total_prize), 0)
  FROM pool_games pg
  JOIN generated_games g ON g.id = pg.game_id
  JOIN game_check_results r ON r.game_id = g.id
  JOIN pools p ON p.id = pg.pool_id
  WHERE pg.pool_id = _pool_id
    AND g.status <> 'PLANNED'
    AND r.contest_number = COALESCE(p.contest_number, p.contest_number_planned, r.contest_number);
$$;

CREATE OR REPLACE FUNCTION public.pool_calculate_distribution(_pool_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total numeric;
  _cents bigint;
  _quotas integer;
  _base bigint;
  _remainder bigint;
  _hash text;
  _current pool_prize_distributions%ROWTYPE;
  _version integer;
  _dist_id uuid;
  _row record;
  _i integer := 0;
  _extra bigint;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador calcula o rateio.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_pool_id::text, 42));

  _total := public.pool_prize_total(_pool_id);
  SELECT COALESCE(SUM(quotas), 0) INTO _quotas FROM pool_participants
   WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share;

  IF _quotas <= 0 THEN
    RAISE EXCEPTION 'Não há cotas elegíveis para o rateio.' USING ERRCODE = '23514';
  END IF;

  SELECT md5(_total::text || ':' || _quotas::text || ':' || COALESCE(string_agg(id::text || ':' || quotas::text, ',' ORDER BY id), ''))
    INTO _hash
    FROM pool_participants
   WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share;

  SELECT * INTO _current FROM pool_prize_distributions
   WHERE pool_id = _pool_id ORDER BY version DESC LIMIT 1;

  -- idempotência: mesma base e ainda válido → devolve o mesmo rateio
  IF _current.id IS NOT NULL AND _current.source_hash = _hash AND _current.status <> 'OUTDATED' THEN
    RETURN _current.id;
  END IF;

  _cents := round(_total * 100)::bigint;
  _base := _cents / _quotas;
  _remainder := _cents - (_base * _quotas);
  _version := COALESCE(_current.version, 0) + 1;

  UPDATE pool_prize_distributions SET status = 'OUTDATED'
   WHERE pool_id = _pool_id AND status = 'CALCULATED';

  INSERT INTO pool_prize_distributions (
    pool_id, version, total_prize, rateable_prize, total_eligible_quotas,
    value_per_quota, rounding_remainder, status, source_hash, calculated_by
  ) VALUES (
    _pool_id, _version, _total, _total, _quotas,
    _base / 100.0, _remainder / 100.0, 'CALCULATED', _hash, auth.uid()
  ) RETURNING id INTO _dist_id;

  -- centavos residuais distribuídos de forma determinística
  FOR _row IN
    SELECT id, quotas, payment_status FROM pool_participants
     WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share
     ORDER BY quotas DESC, name ASC, id ASC
  LOOP
    _extra := CASE WHEN _i < _remainder THEN 1 ELSE 0 END;
    INSERT INTO pool_prize_participants (
      distribution_id, participant_id, eligible_quotas, share_amount,
      rounding_adjustment, payment_status_at_calc
    ) VALUES (
      _dist_id, _row.id, _row.quotas,
      ((_base * _row.quotas) + _extra) / 100.0,
      _extra / 100.0, _row.payment_status
    );
    _i := _i + 1;
  END LOOP;

  PERFORM public.log_pool_event(_pool_id, 'distribution_calculated',
    'Rateio calculado', jsonb_build_object('version', _version, 'total', _total, 'quotas', _quotas));
  RETURN _dist_id;
END; $$;

CREATE OR REPLACE FUNCTION public.pool_confirm_distribution(_distribution_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d pool_prize_distributions%ROWTYPE;
BEGIN
  SELECT * INTO _d FROM pool_prize_distributions WHERE id = _distribution_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'Rateio não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_d.pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador confirma o rateio.' USING ERRCODE = '42501';
  END IF;
  IF _d.status = 'OUTDATED' THEN
    RAISE EXCEPTION 'Este rateio está desatualizado: recalcule antes de confirmar.' USING ERRCODE = '23514';
  END IF;
  UPDATE pool_prize_distributions SET status = 'CONFIRMED', confirmed_at = now() WHERE id = _distribution_id;
  PERFORM public.log_pool_event(_d.pool_id, 'distribution_confirmed', 'Rateio confirmado',
    jsonb_build_object('version', _d.version));
END; $$;

-- premiação alterada → rateio desatualizado
CREATE OR REPLACE FUNCTION public.pool_outdate_on_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pool_id uuid;
BEGIN
  SELECT pool_id INTO _pool_id FROM generated_games WHERE id = NEW.game_id;
  IF _pool_id IS NOT NULL THEN
    UPDATE pool_prize_distributions SET status = 'OUTDATED'
     WHERE pool_id = _pool_id AND status = 'CALCULATED';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS game_check_results_pool_outdate ON public.game_check_results;
CREATE TRIGGER game_check_results_pool_outdate AFTER INSERT OR UPDATE ON public.game_check_results
FOR EACH ROW EXECUTE FUNCTION public.pool_outdate_on_check();

-- ------------------------------------------------------------
-- criação/duplicação/vínculo de jogos com validação no servidor
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pool_attach_game(_pool_id uuid, _game_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador vincula jogos.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.owns_game(_game_id) THEN
    RAISE EXCEPTION 'Este jogo não pertence a você.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM pool_games WHERE game_id = _game_id AND pool_id <> _pool_id) THEN
    RAISE EXCEPTION 'Este jogo já pertence a outro bolão.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO pool_games (pool_id, game_id) VALUES (_pool_id, _game_id)
    ON CONFLICT (game_id) DO NOTHING RETURNING id INTO _id;
  PERFORM public.log_pool_event(_pool_id, 'game_linked', 'Jogo vinculado ao bolão', jsonb_build_object('game', _game_id));
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.pool_detach_game(_pool_id uuid, _game_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador remove jogos.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM pool_games WHERE pool_id = _pool_id AND game_id = _game_id;
  PERFORM public.log_pool_event(_pool_id, 'game_unlinked', 'Jogo removido do bolão', jsonb_build_object('game', _game_id));
END; $$;

-- vínculo automático do concurso oficial quando ele passa a existir
CREATE OR REPLACE FUNCTION public.pool_resolve_planned_contest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE pools SET
    contest_id = NEW.id,
    contest_number = NEW.contest_number,
    draw_date = COALESCE(NEW.draw_date, draw_date)
  WHERE contest_id IS NULL
    AND lottery_id = NEW.lottery_id
    AND COALESCE(contest_number, contest_number_planned) = NEW.contest_number;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS lottery_draws_resolve_pools ON public.lottery_draws;
CREATE TRIGGER lottery_draws_resolve_pools AFTER INSERT ON public.lottery_draws
FOR EACH ROW EXECUTE FUNCTION public.pool_resolve_planned_contest();

-- histórico automático de criação
CREATE OR REPLACE FUNCTION public.pool_created_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_pool_event(NEW.id, 'pool_created', 'Bolão criado', NULL);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pools_created_trg ON public.pools;
CREATE TRIGGER pools_created_trg AFTER INSERT ON public.pools
FOR EACH ROW EXECUTE FUNCTION public.pool_created_event();

CREATE OR REPLACE FUNCTION public.pool_participant_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.log_pool_event(NEW.pool_id, 'participant_added',
    NEW.name || ' entrou no bolão', jsonb_build_object('quotas', NEW.quotas));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS pool_participant_event_trg ON public.pool_participants;
CREATE TRIGGER pool_participant_event_trg AFTER INSERT ON public.pool_participants
FOR EACH ROW EXECUTE FUNCTION public.pool_participant_event();

-- ------------------------------------------------------------
-- permissões de execução
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.recalc_participant_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pool_register_payment(uuid, numeric, timestamptz, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_cancel_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_set_participant_eligibility(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_cancel_participant(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_set_status(uuid, public.pool_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_set_public(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_prize_total(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_calculate_distribution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_confirm_distribution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_attach_game(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_detach_game(uuid, uuid) TO authenticated;