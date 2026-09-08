-- 1. P0: DELETE/UPDATE direto de pagamento -----------------------------------
DROP TRIGGER IF EXISTS pool_payments_guard ON public.pool_payments;
CREATE TRIGGER pool_payments_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.pool_payments
FOR EACH ROW EXECUTE FUNCTION public.guard_pool_payments_fields();

-- Defesa em profundidade: o cliente não precisa de DELETE/UPDATE nesta tabela.
REVOKE DELETE, UPDATE ON public.pool_payments FROM authenticated, anon;
GRANT ALL ON public.pool_payments TO service_role;

-- 2. P1: um único protocolo de exclusão mútua por bolão ------------------------
-- Chave única: pg_advisory_xact_lock(hashtextextended(pool_id::text, 42)).
-- Ordem: o lock consultivo é sempre o PRIMEIRO bloqueio adquirido, antes de
-- qualquer SELECT ... FOR UPDATE, o que evita ciclos de espera.

CREATE OR REPLACE FUNCTION public.pool_participant_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _quota numeric;
  _limit integer;
  _taken integer;
BEGIN
  -- Serializa por bolão antes de ler capacidade (reentrante se já adquirido).
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.pool_id::text, 42));
  SELECT quota_value, total_quotas INTO _quota, _limit FROM pools WHERE id = NEW.pool_id;

  NEW.amount_due := GREATEST(COALESCE(_quota, 0) * GREATEST(COALESCE(NEW.quotas, 0), 0) + COALESCE(NEW.amount_adjustment, 0), 0);
  IF COALESCE(NEW.amount_adjustment, 0) <> 0 AND COALESCE(NEW.adjustment_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste de valor.' USING ERRCODE = '23514';
  END IF;
  IF NEW.eligible_for_prize_share = false AND COALESCE(NEW.ineligible_reason, '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo para retirar o participante do rateio.' USING ERRCODE = '23514';
  END IF;

  -- total_quotas NULL = sem limite definido.
  IF _limit IS NOT NULL AND NEW.status = 'ACTIVE' THEN
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

CREATE OR REPLACE FUNCTION public.pool_add_participant(
  _pool_id uuid, _name text, _phone text DEFAULT NULL::text, _quotas integer DEFAULT 1,
  _adjustment numeric DEFAULT 0, _adjustment_reason text DEFAULT NULL::text,
  _notes text DEFAULT NULL::text, _payment_mode text DEFAULT 'PENDING'::text,
  _payment_amount numeric DEFAULT NULL::numeric, _method text DEFAULT NULL::text,
  _method_description text DEFAULT NULL::text, _paid_at timestamptz DEFAULT now())
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
  _due numeric;
  _amount numeric;
BEGIN
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera participantes.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_pool_id::text, 42));
  IF COALESCE(btrim(_name), '') = '' THEN
    RAISE EXCEPTION 'Informe o nome do participante.' USING ERRCODE = '23514';
  END IF;
  IF _quotas IS NULL OR _quotas < 1 THEN
    RAISE EXCEPTION 'A quantidade de cotas deve ser maior que zero.' USING ERRCODE = '23514';
  END IF;
  IF _payment_mode NOT IN ('PENDING','FULL','PARTIAL') THEN
    RAISE EXCEPTION 'Situação de pagamento inválida.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO pool_participants (pool_id, name, phone, quotas, amount_adjustment, adjustment_reason, notes, amount_due)
  VALUES (_pool_id, btrim(_name), NULLIF(btrim(COALESCE(_phone, '')), ''), _quotas,
          COALESCE(_adjustment, 0), NULLIF(btrim(COALESCE(_adjustment_reason, '')), ''),
          NULLIF(btrim(COALESCE(_notes, '')), ''), 0)
  RETURNING id, amount_due INTO _id, _due;

  IF _payment_mode <> 'PENDING' THEN
    _amount := CASE WHEN _payment_mode = 'FULL' THEN _due ELSE _payment_amount END;
    IF _amount IS NULL OR _amount <= 0 THEN
      RAISE EXCEPTION 'O valor pago deve ser maior que zero.' USING ERRCODE = '23514';
    END IF;
    PERFORM public.pool_register_payment(_id, _amount, COALESCE(_paid_at, now()), _method, NULL,
                                         _payment_mode = 'FULL', _method_description);
  END IF;

  PERFORM public.pool_outdate_distributions(_pool_id, 'Participante incluído: ' || btrim(_name));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.pool_update_participant(_participant_id uuid, _patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p pool_participants%ROWTYPE;
  _pool_id uuid;
  _name text;
  _phone text;
  _quotas integer;
  _adjustment numeric;
  _reason text;
  _notes text;
  _base_changed boolean := false;
BEGIN
  SELECT pool_id INTO _pool_id FROM pool_participants WHERE id = _participant_id;
  IF _pool_id IS NULL THEN RAISE EXCEPTION 'Participante não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera participantes.' USING ERRCODE = '42501';
  END IF;
  -- Lock consultivo antes do lock de linha: mesma ordem em todos os caminhos.
  PERFORM pg_advisory_xact_lock(hashtextextended(_pool_id::text, 42));

  SELECT * INTO _p FROM pool_participants WHERE id = _participant_id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Participante não encontrado.' USING ERRCODE = '42501'; END IF;
  IF _p.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Participante cancelado não pode ser editado.' USING ERRCODE = '23514';
  END IF;

  _name := CASE WHEN _patch ? 'name' THEN btrim(COALESCE(_patch->>'name','')) ELSE _p.name END;
  IF COALESCE(_name, '') = '' THEN
    RAISE EXCEPTION 'Informe o nome do participante.' USING ERRCODE = '23514';
  END IF;

  _phone := CASE WHEN _patch ? 'phone' THEN NULLIF(btrim(COALESCE(_patch->>'phone','')), '') ELSE _p.phone END;
  _notes := CASE WHEN _patch ? 'notes' THEN NULLIF(btrim(COALESCE(_patch->>'notes','')), '') ELSE _p.notes END;

  IF _patch ? 'quotas' THEN
    BEGIN
      _quotas := (_patch->>'quotas')::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'A quantidade de cotas deve ser um número inteiro.' USING ERRCODE = '23514';
    END;
    IF _quotas IS NULL OR _quotas < 1 THEN
      RAISE EXCEPTION 'A quantidade de cotas deve ser maior que zero.' USING ERRCODE = '23514';
    END IF;
  ELSE
    _quotas := _p.quotas;
  END IF;

  IF _patch ? 'adjustment' THEN
    BEGIN
      _adjustment := (_patch->>'adjustment')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'O ajuste deve ser um valor numérico.' USING ERRCODE = '23514';
    END;
    IF _adjustment IS NULL OR _adjustment <> _adjustment THEN
      RAISE EXCEPTION 'O ajuste deve ser um valor numérico.' USING ERRCODE = '23514';
    END IF;
  ELSE
    _adjustment := _p.amount_adjustment;
  END IF;

  _reason := CASE WHEN _patch ? 'adjustment_reason'
                  THEN NULLIF(btrim(COALESCE(_patch->>'adjustment_reason','')), '')
                  ELSE _p.adjustment_reason END;

  _base_changed := (_quotas IS DISTINCT FROM _p.quotas)
                OR (_adjustment IS DISTINCT FROM _p.amount_adjustment);

  UPDATE pool_participants
     SET name = _name,
         phone = _phone,
         quotas = _quotas,
         amount_adjustment = _adjustment,
         adjustment_reason = _reason,
         notes = _notes
   WHERE id = _participant_id;

  PERFORM public.recalc_participant_payment(_participant_id);

  IF _base_changed THEN
    PERFORM public.pool_outdate_distributions(_p.pool_id,
      'Cotas ou valor de ' || _name || ' alterados');
  END IF;

  PERFORM public.log_pool_event(_p.pool_id, 'participant_updated',
    _p.name || ' foi atualizado',
    jsonb_build_object('participant', _name, 'quotas', _quotas, 'adjustment', _adjustment,
                       'base_changed', _base_changed));
END $$;

CREATE OR REPLACE FUNCTION public.pool_cancel_participant(_participant_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p pool_participants%ROWTYPE;
  _pool_id uuid;
BEGIN
  SELECT pool_id INTO _pool_id FROM pool_participants WHERE id = _participant_id;
  IF _pool_id IS NULL THEN RAISE EXCEPTION 'Participante não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera participantes.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_pool_id::text, 42));

  SELECT * INTO _p FROM pool_participants WHERE id = _participant_id FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.pool_update_details(_pool_id uuid, _patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pool pools%ROWTYPE;
  _structural boolean;
  _has_games boolean;
  _taken integer;
  _new_total integer;
  _new_quota numeric;
  _p record;
BEGIN
  -- Mesmo lock e mesma chave dos caminhos que alteram cotas de participantes,
  -- adquirido ANTES do SELECT ... FOR UPDATE da linha do bolão.
  PERFORM pg_advisory_xact_lock(hashtextextended(_pool_id::text, 42));

  SELECT * INTO _pool FROM pools WHERE id = _pool_id FOR UPDATE;
  IF _pool.id IS NULL THEN
    RAISE EXCEPTION 'Bolão não encontrado.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador edita o bolão.' USING ERRCODE = '42501';
  END IF;

  _structural := _pool.status IN ('FORMING','OPEN','CLOSED');
  SELECT EXISTS (SELECT 1 FROM pool_games WHERE pool_id = _pool_id) INTO _has_games;
  -- Leitura de capacidade já sob o lock.
  SELECT COALESCE(SUM(quotas), 0) INTO _taken
    FROM pool_participants WHERE pool_id = _pool_id AND status = 'ACTIVE';

  IF _patch ? 'name' THEN
    IF COALESCE(btrim(_patch->>'name'), '') = '' THEN
      RAISE EXCEPTION 'Informe o nome do bolão.' USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET name = btrim(_patch->>'name') WHERE id = _pool_id;
  END IF;

  IF _patch ? 'notes' THEN
    UPDATE pools SET notes = NULLIF(_patch->>'notes','') WHERE id = _pool_id;
  END IF;

  IF NOT _structural THEN
    IF _patch ?| ARRAY['lottery_id','contest_number','draw_date','quota_value','total_quotas','payment_deadline'] THEN
      RAISE EXCEPTION 'Nesta situação do bolão só é possível ajustar o nome e as observações.' USING ERRCODE = '23514';
    END IF;
    PERFORM public.log_pool_event(_pool_id, 'pool_updated', 'Dados do bolão atualizados', _patch);
    RETURN;
  END IF;

  IF _patch ? 'lottery_id' AND (_patch->>'lottery_id')::uuid IS DISTINCT FROM _pool.lottery_id THEN
    IF _has_games THEN
      RAISE EXCEPTION 'Remova os jogos antes de trocar a modalidade.' USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET lottery_id = (_patch->>'lottery_id')::uuid, contest_id = NULL WHERE id = _pool_id;
  END IF;

  IF _patch ? 'contest_number' THEN
    IF _has_games AND NULLIF(_patch->>'contest_number','')::integer
       IS DISTINCT FROM COALESCE(_pool.contest_number, _pool.contest_number_planned) THEN
      RAISE EXCEPTION 'Remova os jogos antes de trocar o concurso.' USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET
      contest_number = NULLIF(_patch->>'contest_number','')::integer,
      contest_number_planned = NULLIF(_patch->>'contest_number','')::integer,
      contest_id = NULL
    WHERE id = _pool_id;
  END IF;

  IF _patch ? 'draw_date' THEN
    UPDATE pools SET
      draw_date = NULLIF(_patch->>'draw_date','')::date,
      draw_date_planned = NULLIF(_patch->>'draw_date','')::date
    WHERE id = _pool_id;
  END IF;

  IF _patch ? 'payment_deadline' THEN
    UPDATE pools SET payment_deadline = NULLIF(_patch->>'payment_deadline','')::date WHERE id = _pool_id;
  END IF;

  IF _patch ? 'total_quotas' THEN
    _new_total := NULLIF(_patch->>'total_quotas','')::integer;
    IF _new_total IS NOT NULL AND _new_total < 1 THEN
      RAISE EXCEPTION 'O total de cotas deve ser maior que zero ou ficar em branco.' USING ERRCODE = '23514';
    END IF;
    -- NULL continua significando "sem limite definido".
    IF _new_total IS NOT NULL AND _new_total < _taken THEN
      RAISE EXCEPTION 'O bolão já possui % cotas atribuídas.', _taken USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET total_quotas = _new_total WHERE id = _pool_id;
  END IF;

  IF _patch ? 'quota_value' THEN
    _new_quota := NULLIF(_patch->>'quota_value','')::numeric;
    IF _new_quota IS NULL OR _new_quota <= 0 THEN
      RAISE EXCEPTION 'O valor da cota deve ser maior que zero.' USING ERRCODE = '23514';
    END IF;
    UPDATE pools SET quota_value = _new_quota WHERE id = _pool_id;
    IF _new_quota IS DISTINCT FROM _pool.quota_value THEN
      FOR _p IN SELECT id, quotas, amount_adjustment FROM pool_participants WHERE pool_id = _pool_id LOOP
        UPDATE pool_participants
           SET amount_due = GREATEST(_new_quota * GREATEST(COALESCE(_p.quotas,0),0) + COALESCE(_p.amount_adjustment,0), 0)
         WHERE id = _p.id;
        PERFORM public.recalc_participant_payment(_p.id);
      END LOOP;
      UPDATE pool_prize_distributions SET status = 'OUTDATED'
       WHERE pool_id = _pool_id AND status = 'CALCULATED';
    END IF;
  END IF;

  PERFORM public.log_pool_event(_pool_id, 'pool_updated', 'Dados do bolão atualizados', _patch);
END $$;