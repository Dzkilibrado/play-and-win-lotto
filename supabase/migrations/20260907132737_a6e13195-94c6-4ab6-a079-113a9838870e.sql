-- 1) total_quotas passa a ser opcional (NULL = sem limite definido)
ALTER TABLE public.pools ALTER COLUMN total_quotas DROP NOT NULL;
ALTER TABLE public.pools ALTER COLUMN total_quotas DROP DEFAULT;

-- 2) Limite de cotas conferido no banco
CREATE OR REPLACE FUNCTION public.pool_participant_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    SELECT COALESCE(SUM(quotas), 0) INTO _taken
      FROM pool_participants
     WHERE pool_id = NEW.pool_id AND status = 'ACTIVE' AND id <> NEW.id;
    IF _taken + GREATEST(COALESCE(NEW.quotas, 0), 0) > _limit THEN
      RAISE EXCEPTION 'Este bolão tem % cotas no total e % já estão atribuídas.', _limit, _taken
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END; $function$;

-- 3) Edição do bolão pelo organizador, com validações e histórico
CREATE OR REPLACE FUNCTION public.pool_update_details(_pool_id uuid, _patch jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pool pools%ROWTYPE;
  _structural boolean;
  _taken integer;
  _games integer;
  _checked integer;
  _new_name text;
  _new_notes text;
  _new_lottery uuid;
  _new_contest integer;
  _new_draw date;
  _new_total integer;
  _new_quota numeric;
  _new_deadline date;
  _r record;
BEGIN
  SELECT * INTO _pool FROM pools WHERE id = _pool_id FOR UPDATE;
  IF _pool.id IS NULL THEN RAISE EXCEPTION 'Bolão não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador pode editar este bolão.' USING ERRCODE = '42501';
  END IF;

  -- Depois do sorteio/conferência só nome e observações podem mudar.
  _structural := _pool.status IN ('FORMING','OPEN','CLOSED');

  SELECT COALESCE(SUM(quotas), 0) INTO _taken
    FROM pool_participants WHERE pool_id = _pool_id AND status = 'ACTIVE';
  SELECT COUNT(*) INTO _games FROM pool_games WHERE pool_id = _pool_id;
  SELECT COUNT(*) INTO _checked
    FROM pool_games pg JOIN game_check_results r ON r.game_id = pg.game_id
   WHERE pg.pool_id = _pool_id;

  _new_name := COALESCE(NULLIF(_patch->>'name',''), _pool.name);
  _new_notes := CASE WHEN _patch ? 'notes' THEN NULLIF(_patch->>'notes','') ELSE _pool.notes END;
  _new_lottery := CASE WHEN _patch ? 'lottery_id' THEN (_patch->>'lottery_id')::uuid ELSE _pool.lottery_id END;
  _new_contest := CASE WHEN _patch ? 'contest_number' THEN NULLIF(_patch->>'contest_number','')::integer
                       ELSE COALESCE(_pool.contest_number, _pool.contest_number_planned) END;
  _new_draw := CASE WHEN _patch ? 'draw_date' THEN NULLIF(_patch->>'draw_date','')::date
                    ELSE COALESCE(_pool.draw_date, _pool.draw_date_planned) END;
  _new_total := CASE WHEN _patch ? 'total_quotas' THEN NULLIF(_patch->>'total_quotas','')::integer ELSE _pool.total_quotas END;
  _new_quota := CASE WHEN _patch ? 'quota_value' THEN (_patch->>'quota_value')::numeric ELSE _pool.quota_value END;
  _new_deadline := CASE WHEN _patch ? 'payment_deadline' THEN NULLIF(_patch->>'payment_deadline','')::date ELSE _pool.payment_deadline END;

  IF COALESCE(_new_name, '') = '' THEN
    RAISE EXCEPTION 'Dê um nome ao bolão.' USING ERRCODE = '23514';
  END IF;
  IF _new_quota IS NULL OR _new_quota <= 0 THEN
    RAISE EXCEPTION 'O valor da cota deve ser maior que zero.' USING ERRCODE = '23514';
  END IF;
  IF _new_total IS NOT NULL AND _new_total < 1 THEN
    RAISE EXCEPTION 'O total de cotas deve ser maior que zero ou ficar em branco.' USING ERRCODE = '23514';
  END IF;
  IF _new_total IS NOT NULL AND _new_total < _taken THEN
    RAISE EXCEPTION 'Não é possível definir % cotas porque o bolão já possui % cotas atribuídas.', _new_total, _taken
      USING ERRCODE = '23514';
  END IF;

  IF NOT _structural THEN
    IF _new_lottery IS DISTINCT FROM _pool.lottery_id
       OR _new_contest IS DISTINCT FROM COALESCE(_pool.contest_number, _pool.contest_number_planned)
       OR _new_draw IS DISTINCT FROM COALESCE(_pool.draw_date, _pool.draw_date_planned)
       OR _new_total IS DISTINCT FROM _pool.total_quotas
       OR _new_quota IS DISTINCT FROM _pool.quota_value
       OR _new_deadline IS DISTINCT FROM _pool.payment_deadline THEN
      RAISE EXCEPTION 'Nesta situação do bolão só é possível ajustar o nome e as observações.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF _new_lottery IS DISTINCT FROM _pool.lottery_id AND _games > 0 THEN
    RAISE EXCEPTION 'A modalidade não pode mudar porque já existem jogos vinculados a este bolão.' USING ERRCODE = '23514';
  END IF;
  IF _new_contest IS DISTINCT FROM COALESCE(_pool.contest_number, _pool.contest_number_planned) THEN
    IF _checked > 0 THEN
      RAISE EXCEPTION 'O concurso não pode mudar porque este bolão já foi conferido.' USING ERRCODE = '23514';
    END IF;
    IF _games > 0 THEN
      RAISE EXCEPTION 'O concurso não pode mudar porque já existem jogos vinculados a este bolão.' USING ERRCODE = '23514';
    END IF;
    IF _pool.contest_id IS NOT NULL THEN
      RAISE EXCEPTION 'O concurso já foi sorteado e não pode ser trocado.' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE pools SET
    name = _new_name,
    notes = _new_notes,
    lottery_id = _new_lottery,
    contest_number_planned = _new_contest,
    draw_date_planned = _new_draw,
    total_quotas = _new_total,
    quota_value = _new_quota,
    payment_deadline = _new_deadline
  WHERE id = _pool_id;

  -- Histórico: só o que é relevante para auditoria.
  IF _new_name IS DISTINCT FROM _pool.name THEN
    PERFORM public.log_pool_event(_pool_id, 'pool_name_changed', 'Nome alterado',
      jsonb_build_object('from', _pool.name, 'to', _new_name));
  END IF;
  IF _new_quota IS DISTINCT FROM _pool.quota_value THEN
    PERFORM public.log_pool_event(_pool_id, 'pool_quota_value_changed', 'Valor da cota alterado',
      jsonb_build_object('from', _pool.quota_value, 'to', _new_quota));
  END IF;
  IF _new_total IS DISTINCT FROM _pool.total_quotas THEN
    PERFORM public.log_pool_event(_pool_id, 'pool_total_quotas_changed',
      CASE WHEN _new_total IS NULL THEN 'Limite de cotas removido'
           WHEN _pool.total_quotas IS NULL THEN 'Limite de cotas definido'
           ELSE 'Quantidade de cotas alterada' END,
      jsonb_build_object('from', _pool.total_quotas, 'to', _new_total));
  END IF;
  IF _new_deadline IS DISTINCT FROM _pool.payment_deadline THEN
    PERFORM public.log_pool_event(_pool_id, 'pool_deadline_changed', 'Prazo de pagamento alterado',
      jsonb_build_object('from', _pool.payment_deadline, 'to', _new_deadline));
  END IF;
  IF _new_contest IS DISTINCT FROM COALESCE(_pool.contest_number, _pool.contest_number_planned) THEN
    PERFORM public.log_pool_event(_pool_id, 'pool_contest_changed', 'Concurso corrigido',
      jsonb_build_object('from', COALESCE(_pool.contest_number, _pool.contest_number_planned), 'to', _new_contest));
  END IF;
  IF _new_draw IS DISTINCT FROM COALESCE(_pool.draw_date, _pool.draw_date_planned) THEN
    PERFORM public.log_pool_event(_pool_id, 'pool_draw_date_changed', 'Data prevista do sorteio alterada',
      jsonb_build_object('from', COALESCE(_pool.draw_date, _pool.draw_date_planned), 'to', _new_draw));
  END IF;
  IF _new_lottery IS DISTINCT FROM _pool.lottery_id THEN
    PERFORM public.log_pool_event(_pool_id, 'pool_lottery_changed', 'Modalidade alterada', NULL);
  END IF;
  IF _new_notes IS DISTINCT FROM _pool.notes THEN
    PERFORM public.log_pool_event(_pool_id, 'pool_notes_changed', 'Observações alteradas', NULL);
  END IF;

  -- Valor da cota ou prazo mudou: recalcula devido/situação preservando pagamentos.
  IF _new_quota IS DISTINCT FROM _pool.quota_value THEN
    FOR _r IN SELECT id FROM pool_participants WHERE pool_id = _pool_id LOOP
      UPDATE pool_participants SET quotas = quotas WHERE id = _r.id;
      PERFORM public.recalc_participant_payment(_r.id);
    END LOOP;
  ELSIF _new_deadline IS DISTINCT FROM _pool.payment_deadline THEN
    FOR _r IN SELECT id FROM pool_participants WHERE pool_id = _pool_id LOOP
      PERFORM public.recalc_participant_payment(_r.id);
    END LOOP;
  END IF;

  -- Rateio pendente deixa de valer quando a base financeira muda.
  IF _new_quota IS DISTINCT FROM _pool.quota_value OR _new_total IS DISTINCT FROM _pool.total_quotas THEN
    UPDATE pool_prize_distributions SET status = 'OUTDATED'
     WHERE pool_id = _pool_id AND status = 'CALCULATED';
  END IF;
END; $function$;

REVOKE ALL ON FUNCTION public.pool_update_details(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_update_details(uuid, jsonb) TO authenticated;

-- 4) Resumo público: agregados + apenas participantes com pagamento integral
CREATE OR REPLACE FUNCTION public.pool_public_summary(_token text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'paidQuotas', COALESCE((SELECT SUM(pp.quotas) FROM pool_participants pp
        WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE' AND pp.payment_status = 'PAID'), 0),
    'confirmedParticipants', COALESCE((SELECT COUNT(*) FROM pool_participants pp
        WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE' AND pp.payment_status = 'PAID'), 0),
    'availableQuotas', CASE WHEN p.total_quotas IS NULL THEN NULL ELSE GREATEST(
        p.total_quotas - COALESCE((SELECT SUM(pp.quotas) FROM pool_participants pp
          WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE'), 0), 0) END,
    'games', COALESCE((SELECT COUNT(*) FROM pool_games pg WHERE pg.pool_id = p.id), 0),
    'participants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', pp.name, 'quotas', pp.quotas)
                         ORDER BY pp.name, pp.created_at)
        FROM pool_participants pp
        WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE' AND pp.payment_status = 'PAID'
      ), '[]'::jsonb)
  )
  FROM pools p JOIN lotteries l ON l.id = p.lottery_id
  WHERE p.public_token = _token AND p.is_public = true;
$function$;