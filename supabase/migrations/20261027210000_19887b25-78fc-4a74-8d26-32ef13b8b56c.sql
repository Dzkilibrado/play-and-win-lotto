-- +Milionária: faixas conjuntas (dezenas + trevos), tabela completa de preços
-- e validação da escolha de trevos.
--
--   1. 10 faixas oficiais em `lottery_prize_tiers`. `hits` guarda a CHAVE da
--      faixa (dezenas × 10 + maior nº de trevos aceito: 62, 61, 52 … 21),
--      única por faixa — a mesma chave vai em `draw_prizes.hits` e na
--      decomposição da conferência, sem mudar esses esquemas.
--   2. Os índices únicos de preço passam a considerar os trevos. Preço = C(dezenas,6) × C(trevos,2) × R$ 6,00, para 6–12 dezenas e 2–6
--      trevos (35 linhas; 12 dezenas + 6 trevos = R$ 83.160,00). Substitui a
--      linha única de trevo-base da fundação.
--   3. `guard_game_secondary` passa a validar também os trevos (2 a 6,
--      distintos, de 1 a 6).
--
-- Idempotente. A modalidade continua inativa.

-- ---- 1. faixas ----
INSERT INTO public.lottery_prize_tiers (lottery_id, hits, label, sort_order)
SELECT l.id, v.hits, v.label, v.sort_order
FROM public.lotteries l, (VALUES
  (62, '6 acertos + 2 trevos', 1),
  (61, '6 acertos + 1 ou nenhum trevo', 2),
  (52, '5 acertos + 2 trevos', 3),
  (51, '5 acertos + 1 ou nenhum trevo', 4),
  (42, '4 acertos + 2 trevos', 5),
  (41, '4 acertos + 1 ou nenhum trevo', 6),
  (32, '3 acertos + 2 trevos', 7),
  (31, '3 acertos + 1 trevo', 8),
  (22, '2 acertos + 2 trevos', 9),
  (21, '2 acertos + 1 trevo', 10)
) AS v(hits, label, sort_order)
WHERE l.slug = 'mais-milionaria'
ON CONFLICT (lottery_id, hits) DO NOTHING;

-- ---- 2. preços ----
-- Os índices únicos de versão/ativo só olhavam (modalidade, dezenas): com a
-- escolha de trevos, o mesmo nº de dezenas tem um preço por quantidade de
-- trevos. Incluem agora `secondary_selected` (0 nas demais modalidades, então
-- nada muda para elas).
DROP INDEX IF EXISTS public.lottery_prices_unique_version;
CREATE UNIQUE INDEX lottery_prices_unique_version
  ON public.lottery_prices (lottery_id, numbers_selected, secondary_selected, valid_from);
DROP INDEX IF EXISTS public.lottery_prices_one_active;
CREATE UNIQUE INDEX lottery_prices_one_active
  ON public.lottery_prices (lottery_id, numbers_selected, secondary_selected) WHERE is_active;

DELETE FROM public.lottery_prices
WHERE lottery_id = (SELECT id FROM public.lotteries WHERE slug = 'mais-milionaria');

INSERT INTO public.lottery_prices
  (lottery_id, numbers_selected, secondary_selected, combination_count, price, source)
SELECT l.id, v.n, v.t, v.c, v.price, 'caixa'
FROM public.lotteries l, (VALUES
  (6, 2, 1, 6.00),
  (6, 3, 3, 18.00),
  (6, 4, 6, 36.00),
  (6, 5, 10, 60.00),
  (6, 6, 15, 90.00),
  (7, 2, 7, 42.00),
  (7, 3, 21, 126.00),
  (7, 4, 42, 252.00),
  (7, 5, 70, 420.00),
  (7, 6, 105, 630.00),
  (8, 2, 28, 168.00),
  (8, 3, 84, 504.00),
  (8, 4, 168, 1008.00),
  (8, 5, 280, 1680.00),
  (8, 6, 420, 2520.00),
  (9, 2, 84, 504.00),
  (9, 3, 252, 1512.00),
  (9, 4, 504, 3024.00),
  (9, 5, 840, 5040.00),
  (9, 6, 1260, 7560.00),
  (10, 2, 210, 1260.00),
  (10, 3, 630, 3780.00),
  (10, 4, 1260, 7560.00),
  (10, 5, 2100, 12600.00),
  (10, 6, 3150, 18900.00),
  (11, 2, 462, 2772.00),
  (11, 3, 1386, 8316.00),
  (11, 4, 2772, 16632.00),
  (11, 5, 4620, 27720.00),
  (11, 6, 6930, 41580.00),
  (12, 2, 924, 5544.00),
  (12, 3, 2772, 16632.00),
  (12, 4, 5544, 33264.00),
  (12, 5, 9240, 55440.00),
  (12, 6, 13860, 83160.00)
) AS v(n, t, c, price)
WHERE l.slug = 'mais-milionaria';

-- ---- 3. seleção secundária válida (mês, time e trevos) ----
CREATE OR REPLACE FUNCTION public.guard_game_secondary()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _kind text;
  _value text;
BEGIN
  SELECT secondary_kind INTO _kind FROM public.lotteries WHERE id = NEW.lottery_id;

  IF cardinality(NEW.secondary_selection) = 0 THEN
    RETURN NEW;
  END IF;

  IF _kind IS NULL OR _kind NOT IN ('mes', 'time', 'trevo') THEN
    RAISE EXCEPTION 'Esta modalidade não tem seleção secundária.' USING ERRCODE = 'check_violation';
  END IF;

  IF _kind = 'trevo' THEN
    IF cardinality(NEW.secondary_selection) NOT BETWEEN 2 AND 6 THEN
      RAISE EXCEPTION 'Escolha de 2 a 6 trevos.' USING ERRCODE = 'check_violation';
    END IF;
    IF (SELECT count(DISTINCT v) FROM unnest(NEW.secondary_selection) v) <> cardinality(NEW.secondary_selection) THEN
      RAISE EXCEPTION 'Trevos repetidos.' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(NEW.secondary_selection) v WHERE v !~ '^[1-6]$') THEN
      RAISE EXCEPTION 'Trevo inválido (use de 1 a 6).' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF cardinality(NEW.secondary_selection) <> 1 THEN
    RAISE EXCEPTION 'Escolha exatamente uma opção (%).', _kind USING ERRCODE = 'check_violation';
  END IF;

  _value := NEW.secondary_selection[1];
  IF _kind = 'mes' AND _value !~ '^(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Mês da Sorte inválido: %', _value USING ERRCODE = 'check_violation';
  END IF;
  IF _kind = 'time' AND NOT EXISTS (
    SELECT 1 FROM public.lottery_secondary_options o
    WHERE o.lottery_id = NEW.lottery_id AND o.value = _value AND o.is_active
  ) THEN
    RAISE EXCEPTION 'Time do Coração inválido: %', _value USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
