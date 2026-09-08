-- 1. Guarda de campos derivados em pool_participants -------------------------
CREATE OR REPLACE FUNCTION public.guard_pool_participants_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.pool_internal', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.total_paid := 0;
    NEW.payment_status := 'PENDING';
    NEW.paid_at := NULL;
    NEW.status := 'ACTIVE';
    NEW.cancelled_at := NULL;
    NEW.eligible_for_prize_share := true;
    NEW.ineligible_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.total_paid IS DISTINCT FROM OLD.total_paid
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'A situação de pagamento vem apenas dos pagamentos registrados.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
    RAISE EXCEPTION 'O cancelamento do participante é feito apenas pela ação de cancelar.' USING ERRCODE = '42501';
  END IF;
  IF NEW.eligible_for_prize_share IS DISTINCT FROM OLD.eligible_for_prize_share
     OR NEW.ineligible_reason IS DISTINCT FROM OLD.ineligible_reason THEN
    RAISE EXCEPTION 'A participação no rateio é alterada apenas pela ação específica.' USING ERRCODE = '42501';
  END IF;
  IF NEW.pool_id IS DISTINCT FROM OLD.pool_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O vínculo do participante não pode ser alterado.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pool_participants_guard ON public.pool_participants;
CREATE TRIGGER pool_participants_guard
BEFORE INSERT OR UPDATE ON public.pool_participants
FOR EACH ROW EXECUTE FUNCTION public.guard_pool_participants_fields();

-- 2. Guarda de pagamentos ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_pool_payments_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.pool_internal', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Pagamentos são corrigidos apenas pela ação de cancelar pagamento.' USING ERRCODE = '42501';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount <> NEW.amount THEN
    RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero.' USING ERRCODE = '23514';
  END IF;
  IF NEW.method IS NOT NULL AND NEW.method NOT IN ('PIX','CASH','CARD','OTHER') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.' USING ERRCODE = '23514';
  END IF;
  IF NEW.method = 'OTHER' AND COALESCE(btrim(NEW.method_description), '') = '' THEN
    RAISE EXCEPTION 'Descreva a forma de pagamento.' USING ERRCODE = '23514';
  END IF;
  NEW.cancelled_at := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pool_payments_guard ON public.pool_payments;
CREATE TRIGGER pool_payments_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.pool_payments
FOR EACH ROW EXECUTE FUNCTION public.guard_pool_payments_fields();

-- 3. Marcar as escritas oficiais ----------------------------------------------
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

  PERFORM set_config('app.pool_internal', 'on', true);
  UPDATE pool_participants
     SET total_paid = _paid,
         payment_status = _status,
         paid_at = CASE WHEN _status = 'PAID' THEN _last ELSE NULL END
   WHERE id = _participant_id;
  PERFORM set_config('app.pool_internal', '', true);
END $$;

CREATE OR REPLACE FUNCTION public.pool_cancel_participant(_participant_id uuid, _reason text DEFAULT NULL)
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
  PERFORM set_config('app.pool_internal', 'on', true);
  UPDATE pool_participants
     SET status = 'CANCELLED', cancelled_at = now(), eligible_for_prize_share = false,
         ineligible_reason = _reason, notes = COALESCE(notes, '')
   WHERE id = _participant_id;
  PERFORM set_config('app.pool_internal', '', true);
  PERFORM public.recalc_participant_payment(_participant_id);
  PERFORM public.log_pool_event(_p.pool_id, 'participant_cancelled',
    _p.name || ' foi cancelado', jsonb_build_object('participant', _p.name, 'reason', _reason));
END $$;

-- 4. Rateio desatualizado após confirmação -------------------------------------
DROP FUNCTION IF EXISTS public.pool_outdate_distributions(uuid);
CREATE OR REPLACE FUNCTION public.pool_outdate_distributions(_pool_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _confirmed integer := 0;
BEGIN
  UPDATE pool_prize_distributions SET status = 'OUTDATED', updated_at = now()
   WHERE pool_id = _pool_id AND status = 'CONFIRMED';
  GET DIAGNOSTICS _confirmed = ROW_COUNT;

  UPDATE pool_prize_distributions SET status = 'OUTDATED', updated_at = now()
   WHERE pool_id = _pool_id AND status = 'CALCULATED';

  IF _confirmed > 0 THEN
    PERFORM public.log_pool_event(_pool_id, 'distribution_outdated',
      'O rateio confirmado ficou desatualizado: recalcule e confirme novamente.',
      jsonb_build_object('reason', _reason, 'confirmed_versions', _confirmed));
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.pool_outdate_distributions(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pool_outdate_on_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pool_id uuid;
  _latest pool_prize_distributions%ROWTYPE;
  _total numeric;
BEGIN
  SELECT pool_id INTO _pool_id FROM generated_games WHERE id = NEW.game_id;
  IF _pool_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO _latest FROM pool_prize_distributions
   WHERE pool_id = _pool_id ORDER BY version DESC LIMIT 1;
  IF _latest.id IS NULL THEN RETURN NEW; END IF;
  IF _latest.status = 'OUTDATED' THEN RETURN NEW; END IF;

  _total := public.pool_prize_total(_pool_id);
  -- Reprocessamento que não altera o prêmio é idempotente: nada a invalidar.
  IF round(COALESCE(_total, 0) * 100) = round(COALESCE(_latest.total_prize, 0) * 100) THEN
    RETURN NEW;
  END IF;

  PERFORM public.pool_outdate_distributions(_pool_id,
    'Prêmio oficial alterado de ' || _latest.total_prize::text || ' para ' || COALESCE(_total, 0)::text);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.pool_set_participant_eligibility(_participant_id uuid, _eligible boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  PERFORM set_config('app.pool_internal', 'on', true);
  UPDATE pool_participants
     SET eligible_for_prize_share = _eligible,
         ineligible_reason = CASE WHEN _eligible THEN NULL ELSE _reason END
   WHERE id = _participant_id;
  PERFORM set_config('app.pool_internal', '', true);
  PERFORM public.pool_outdate_distributions(_p.pool_id, 'Participação no rateio alterada');
  PERFORM public.log_pool_event(_p.pool_id, 'participant_eligibility',
    CASE WHEN _eligible THEN _p.name || ' voltou a participar do rateio'
         ELSE _p.name || ' foi retirado do rateio' END,
    jsonb_build_object('participant', _p.name, 'reason', _reason));
END $$;

-- 5. Concorrência na última cota ------------------------------------------------
CREATE OR REPLACE FUNCTION public.pool_participant_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _quota numeric;
  _limit integer;
  _taken integer;
BEGIN
  SELECT quota_value, total_quotas INTO _quota, _limit FROM pools WHERE id = NEW.pool_id;
  NEW.amount_due := GREATEST(COALESCE(_quota, 0) * GREATEST(COALESCE(NEW.quotas, 0), 0) + COALESCE(NEW.amount_adjustment, 0), 0);
  IF COALESCE(NEW.amount_adjustment, 0) <> 0 AND COALESCE(NEW.adjustment_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste de valor.' USING ERRCODE = '23514';
  END IF;
  IF NEW.eligible_for_prize_share = false AND COALESCE(NEW.ineligible_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo para retirar o participante do rateio.' USING ERRCODE = '23514';
  END IF;

  IF _limit IS NOT NULL AND NEW.status = 'ACTIVE' THEN
    -- Serializa por bolão: duas inclusões simultâneas não podem ler a mesma
    -- disponibilidade e ultrapassar o total de cotas.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.pool_id::text, 42));
    SELECT COALESCE(SUM(quotas), 0) INTO _taken
      FROM pool_participants
     WHERE pool_id = NEW.pool_id AND status = 'ACTIVE' AND id <> NEW.id;
    IF _taken + GREATEST(COALESCE(NEW.quotas, 0), 0) > _limit THEN
      RAISE EXCEPTION 'Este bolão tem % cotas no total e % já estão atribuídas.', _limit, _taken
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- 6. Novo cálculo invalida qualquer rateio anterior -----------------------------
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
  _count integer;
  _i integer := 0;
  _extra bigint;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador calcula o rateio.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_pool_id::text, 42));

  _total := public.pool_prize_total(_pool_id);
  SELECT COALESCE(SUM(quotas), 0), COUNT(*) INTO _quotas, _count FROM pool_participants
   WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share AND quotas > 0;

  IF _quotas <= 0 THEN
    RAISE EXCEPTION 'Não há cotas elegíveis para o rateio.' USING ERRCODE = '23514';
  END IF;

  SELECT md5(_total::text || ':' || _quotas::text || ':' || COALESCE(string_agg(id::text || ':' || quotas::text, ',' ORDER BY id), ''))
    INTO _hash
    FROM pool_participants
   WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share AND quotas > 0;

  SELECT * INTO _current FROM pool_prize_distributions
   WHERE pool_id = _pool_id ORDER BY version DESC LIMIT 1;

  IF _current.id IS NOT NULL AND _current.source_hash = _hash AND _current.status <> 'OUTDATED' THEN
    RETURN _current.id;
  END IF;

  _cents := round(_total * 100)::bigint;
  _base := _cents / _quotas;
  _remainder := _cents - (_base * _quotas);
  _version := COALESCE(_current.version, 0) + 1;

  -- Qualquer rateio anterior (inclusive confirmado) deixa de ser vigente.
  PERFORM public.pool_outdate_distributions(_pool_id, 'Novo cálculo de rateio (versão ' || _version::text || ')');

  INSERT INTO pool_prize_distributions (
    pool_id, version, total_prize, rateable_prize, total_eligible_quotas,
    value_per_quota, rounding_remainder, status, source_hash, calculated_by
  ) VALUES (
    _pool_id, _version, _total, _total, _quotas,
    _base / 100.0, _remainder / 100.0, 'CALCULATED', _hash, auth.uid()
  ) RETURNING id INTO _dist_id;

  -- A sobra pode superar o número de participantes: cada um recebe
  -- floor(sobra/participantes) centavos e os primeiros da ordem
  -- determinística recebem um centavo adicional. A soma fecha exata.
  FOR _row IN
    SELECT id, quotas, payment_status FROM pool_participants
     WHERE pool_id = _pool_id AND status = 'ACTIVE' AND eligible_for_prize_share AND quotas > 0
     ORDER BY quotas DESC, name ASC, id ASC
  LOOP
    _extra := (_remainder / _count) + CASE WHEN _i < (_remainder % _count) THEN 1 ELSE 0 END;
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
END $$;

-- 7. Identidade pública estável dos participantes -------------------------------
CREATE OR REPLACE FUNCTION public.pool_public_summary(_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (
    SELECT * FROM pools WHERE public_token = _token AND is_public = true
  ),
  d AS (
    SELECT ld.* FROM lottery_draws ld JOIN p ON p.lottery_id = ld.lottery_id
    WHERE ld.contest_number = COALESCE(p.contest_number, p.contest_number_planned)
    LIMIT 1
  ),
  part AS (
    SELECT row_number() OVER (ORDER BY pp.name, pp.created_at, pp.id) AS ordinal,
           pp.name, pp.quotas
    FROM pool_participants pp JOIN p ON p.id = pp.pool_id
    WHERE pp.status = 'ACTIVE' AND pp.payment_status = 'PAID'
  ),
  g AS (
    SELECT gg.id,
           row_number() OVER (ORDER BY gg.created_at, gg.id) AS ordinal,
           gg.status,
           COALESCE((SELECT array_agg(gn.number ORDER BY gn.number)
                     FROM game_numbers gn WHERE gn.game_id = gg.id), '{}') AS numbers,
           r.hits, r.is_prized, r.prize_label, r.total_prize
    FROM pool_games pg
    JOIN p ON p.id = pg.pool_id
    JOIN generated_games gg ON gg.id = pg.game_id
    LEFT JOIN game_check_results r ON r.game_id = gg.id
    WHERE gg.status <> 'PLANNED'
  )
  SELECT jsonb_build_object(
    'name', p.name,
    'lottery', l.name,
    'lotterySlug', l.slug,
    'contestNumber', COALESCE(p.contest_number, p.contest_number_planned),
    'drawDate', COALESCE(p.draw_date, p.draw_date_planned),
    'drawDatePlanned', (p.draw_date IS NULL),
    'status', p.status,
    'totalQuotas', p.total_quotas,
    'assignedQuotas', COALESCE((SELECT SUM(pp.quotas) FROM pool_participants pp
        WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE'), 0),
    'paidQuotas', COALESCE((SELECT SUM(part.quotas) FROM part), 0),
    'confirmedParticipants', (SELECT COUNT(*) FROM part),
    'availableQuotas', CASE WHEN p.total_quotas IS NULL THEN NULL ELSE GREATEST(
        p.total_quotas - COALESCE((SELECT SUM(pp.quotas) FROM pool_participants pp
          WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE'), 0), 0) END,
    'games', (SELECT COUNT(*) FROM g),
    'participants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('ordinal', part.ordinal, 'name', part.name, 'quotas', part.quotas)
                         ORDER BY part.ordinal)
        FROM part
      ), '[]'::jsonb),
    'gameList', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'ordinal', g.ordinal,
                 'numbers', g.numbers,
                 'status', g.status,
                 'hits', g.hits,
                 'isPrized', g.is_prized,
                 'prizeLabel', g.prize_label,
                 'prizeAmount', g.total_prize
               ) ORDER BY g.ordinal)
        FROM g
      ), '[]'::jsonb),
    'result', (
      SELECT CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
        'contestNumber', d.contest_number,
        'drawDate', d.draw_date,
        'drawnNumbers', COALESCE((SELECT array_agg(dn.number ORDER BY dn.number)
                                  FROM draw_numbers dn WHERE dn.draw_id = d.id), '{}'),
        'checkedGames', (SELECT COUNT(*) FROM g WHERE g.hits IS NOT NULL),
        'prizedGames', (SELECT COUNT(*) FROM g WHERE g.is_prized),
        'totalPrize', (SELECT SUM(g.total_prize) FROM g WHERE g.is_prized)
      ) END FROM d
    )
  )
  FROM p JOIN lotteries l ON l.id = p.lottery_id;
$$;