DROP TRIGGER IF EXISTS pool_payments_guard ON public.pool_payments;
CREATE TRIGGER pool_payments_guard
BEFORE INSERT OR UPDATE ON public.pool_payments
FOR EACH ROW EXECUTE FUNCTION public.guard_pool_payments_fields();

CREATE OR REPLACE FUNCTION public.pool_cancel_payment(_payment_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pay pool_payments%ROWTYPE;
BEGIN
  SELECT * INTO _pay FROM pool_payments WHERE id = _payment_id FOR UPDATE;
  IF _pay.id IS NULL THEN RAISE EXCEPTION 'Pagamento não encontrado.' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_pool_owner(_pay.pool_id) THEN
    RAISE EXCEPTION 'Somente o organizador altera pagamentos.' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('app.pool_internal', 'on', true);
  UPDATE pool_payments SET cancelled_at = now(), notes = COALESCE(_reason, notes) WHERE id = _payment_id;
  PERFORM set_config('app.pool_internal', '', true);
  PERFORM public.recalc_participant_payment(_pay.participant_id);
  PERFORM public.log_pool_event(_pay.pool_id, 'payment_cancelled', 'Pagamento corrigido/removido',
    jsonb_build_object('amount', _pay.amount, 'reason', _reason));
END $$;

REVOKE ALL ON FUNCTION public.guard_pool_participants_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_pool_payments_fields() FROM PUBLIC, anon, authenticated;