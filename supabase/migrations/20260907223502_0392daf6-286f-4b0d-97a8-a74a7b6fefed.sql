ALTER TABLE public.pool_payments ADD COLUMN IF NOT EXISTS method_description text;

UPDATE public.pool_payments
   SET method = CASE
     WHEN lower(btrim(method)) IN ('pix') THEN 'PIX'
     WHEN lower(btrim(method)) IN ('dinheiro','especie','espécie','cash','em dinheiro') THEN 'CASH'
     WHEN lower(btrim(method)) IN ('cartao','cartão','card','cartao de credito','cartão de crédito','cartao de debito','cartão de débito') THEN 'CARD'
     ELSE 'OTHER'
   END,
   method_description = CASE
     WHEN lower(btrim(method)) IN ('pix','dinheiro','especie','espécie','cash','em dinheiro','cartao','cartão','card','cartao de credito','cartão de crédito','cartao de debito','cartão de débito') THEN method_description
     ELSE COALESCE(method_description, btrim(method))
   END
 WHERE method IS NOT NULL AND btrim(method) <> '' AND method NOT IN ('PIX','CASH','CARD','OTHER');

UPDATE public.pool_payments SET method = NULL WHERE method IS NOT NULL AND btrim(method) = '';

ALTER TABLE public.pool_payments
  ADD CONSTRAINT pool_payments_method_canonical
  CHECK (method IS NULL OR method IN ('PIX','CASH','CARD','OTHER'));

ALTER TABLE public.pool_payments
  ADD CONSTRAINT pool_payments_other_needs_description
  CHECK (method IS DISTINCT FROM 'OTHER' OR COALESCE(btrim(method_description), '') <> '');

CREATE OR REPLACE FUNCTION public.pool_outdate_distributions(_pool_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE pool_prize_distributions SET status = 'OUTDATED'
   WHERE pool_id = _pool_id AND status = 'CALCULATED';
END; $$;

REVOKE ALL ON FUNCTION public.pool_outdate_distributions(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pool_outdate_distributions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pool_register_payment(
  _participant_id uuid,
  _amount numeric,
  _paid_at timestamp with time zone DEFAULT now(),
  _method text DEFAULT NULL::text,
  _notes text DEFAULT NULL::text,
  _allow_overpay boolean DEFAULT false,
  _method_description text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF _amount IS NULL OR _amount <= 0 OR _amount <> _amount THEN
    RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero.' USING ERRCODE = '23514';
  END IF;
  IF _method IS NOT NULL AND _method NOT IN ('PIX','CASH','CARD','OTHER') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida.' USING ERRCODE = '23514';
  END IF;
  IF _method = 'OTHER' AND COALESCE(btrim(_method_description), '') = '' THEN
    RAISE EXCEPTION 'Descreva a forma de pagamento.' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _paid FROM pool_payments
   WHERE participant_id = _participant_id AND cancelled_at IS NULL;

  IF _paid + _amount > _p.amount_due AND NOT _allow_overpay THEN
    RAISE EXCEPTION 'Valor acima do devido: confirme o excedente para continuar.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO pool_payments (pool_id, participant_id, amount, paid_at, method, method_description, notes, created_by)
  VALUES (_p.pool_id, _participant_id, _amount, _paid_at, _method,
          CASE WHEN _method = 'OTHER' THEN btrim(_method_description) ELSE NULL END,
          _notes, auth.uid())
  RETURNING id INTO _id;

  PERFORM public.log_pool_event(_p.pool_id, 'payment_registered',
    'Pagamento registrado para ' || _p.name,
    jsonb_build_object('participant', _p.name, 'amount', _amount, 'method', _method,
                       'overpay', (_paid + _amount) > _p.amount_due));
  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.pool_register_payment(uuid, numeric, timestamptz, text, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.pool_register_payment(uuid, numeric, timestamptz, text, text, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pool_add_participant(
  _pool_id uuid,
  _name text,
  _phone text DEFAULT NULL,
  _quotas integer DEFAULT 1,
  _adjustment numeric DEFAULT 0,
  _adjustment_reason text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _payment_mode text DEFAULT 'PENDING',
  _payment_amount numeric DEFAULT NULL,
  _method text DEFAULT NULL,
  _method_description text DEFAULT NULL,
  _paid_at timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  PERFORM public.pool_outdate_distributions(_pool_id);
  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.pool_add_participant(uuid, text, text, integer, numeric, text, text, text, numeric, text, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.pool_add_participant(uuid, text, text, integer, numeric, text, text, text, numeric, text, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.pool_update_participant(_participant_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    PERFORM public.pool_outdate_distributions(_p.pool_id);
  END IF;

  PERFORM public.log_pool_event(_p.pool_id, 'participant_updated',
    _p.name || ' foi atualizado',
    jsonb_build_object('participant', _name, 'quotas', _quotas, 'adjustment', _adjustment,
                       'base_changed', _base_changed));
END; $$;

REVOKE ALL ON FUNCTION public.pool_update_participant(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.pool_update_participant(uuid, jsonb) TO authenticated;