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
  _name text;
  _phone text;
  _quotas integer;
  _adjustment numeric;
  _reason text;
  _notes text;
  _base_changed boolean := false;
BEGIN
  SELECT * INTO _p FROM pool_participants WHERE id = _participant_id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Participante não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_p.pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera participantes.' USING ERRCODE = '42501';
  END IF;
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