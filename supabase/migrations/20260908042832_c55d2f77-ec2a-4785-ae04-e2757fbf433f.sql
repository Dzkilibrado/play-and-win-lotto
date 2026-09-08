CREATE OR REPLACE FUNCTION public.guard_pool_payments_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.pool_internal', true), '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Exclusão em cascata do bolão/participante (a linha-pai já não existe):
    -- é uma remoção legítima do conjunto, não a exclusão avulsa de um pagamento.
    IF NOT EXISTS (SELECT 1 FROM pools WHERE id = OLD.pool_id)
       OR NOT EXISTS (SELECT 1 FROM pool_participants WHERE id = OLD.participant_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Pagamentos não podem ser apagados: use a ação de cancelar pagamento.' USING ERRCODE = '42501';
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