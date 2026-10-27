-- ============================================================
-- Fundação para novas modalidades (Lotomania, Dupla Sena, Dia de
-- Sorte, Timemania, +Milionária, Super Sete).
--
-- Nesta migração:
--   1. Estende `lotteries` com metadados genéricos para uma
--      modalidade com SORTEIO DUPLO por concurso (Dupla Sena) e/ou
--      uma SELEÇÃO SECUNDÁRIA opcional (trevo, mês da sorte, time
--      do coração) — sem alterar o significado de nenhuma coluna
--      existente nem o comportamento das 3 modalidades atuais.
--   2. Estende `lottery_prices` com `secondary_selected`, para
--      suportar preço que varia também pela seleção secundária
--      (caso da +Milionária). Nas demais, fica sempre 0.
--   3. Estende `lottery_draws` com `draw_sequence`, para suportar
--      mais de um sorteio por concurso (Dupla Sena = 2).
--   4. Insere as 6 novas modalidades como referência (`lotteries`,
--      `lottery_prize_tiers`, `lottery_prices`). Lotomania e Dupla
--      Sena entram ATIVAS (`is_active = true`) porque não dependem
--      de seleção secundária — o restante do sistema (motor de
--      geração, estratégia por orçamento, conferência, volante)
--      já é genérico por `lottery_id`/configuração e funciona para
--      elas sem mudança adicional. As demais entram INATIVAS
--      (`is_active = false`): os dados de referência já existem,
--      mas a seleção secundária (trevo/mês/time) e a conferência
--      correspondente ainda não têm interface nem motor — ficam
--      para PRs dedicados, sem expor um jogo incompleto ao usuário.
--
-- Nenhum preço é inventado: todos vêm de C(n, base) × preço oficial
-- da aposta simples, a mesma regra que `combinationCount` já usa
-- para Mega-Sena/Lotofácil/Quina (ver `src/config/lotteries.ts`).
-- ============================================================

ALTER TABLE public.lotteries
  ADD COLUMN draws_per_contest int NOT NULL DEFAULT 1,
  ADD COLUMN secondary_kind text,
  ADD COLUMN secondary_label text,
  ADD COLUMN secondary_universe_min int,
  ADD COLUMN secondary_universe_max int,
  ADD COLUMN secondary_min_selectable int,
  ADD COLUMN secondary_max_selectable int,
  ADD COLUMN secondary_base_selectable int;

COMMENT ON COLUMN public.lotteries.draws_per_contest IS
  'Quantos sorteios independentes um único concurso produz (1 na maioria; 2 na Dupla Sena).';
COMMENT ON COLUMN public.lotteries.secondary_kind IS
  'Tipo da seleção secundária opcional desta modalidade: trevo | mes | time. NULL = não tem.';

ALTER TABLE public.lottery_prices
  ADD COLUMN secondary_selected int NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.lottery_prices.secondary_selected IS
  'Quantidade selecionada na seleção secundária quando ela afeta o preço (trevos da +Milionária). 0 quando não há seleção secundária ou ela não muda o preço.';

DROP INDEX IF EXISTS public.lottery_prices_lookup;
CREATE INDEX lottery_prices_lookup
  ON public.lottery_prices (lottery_id, numbers_selected, secondary_selected, is_active);

ALTER TABLE public.lottery_draws
  ADD COLUMN draw_sequence int NOT NULL DEFAULT 1;
COMMENT ON COLUMN public.lottery_draws.draw_sequence IS
  '1º ou 2º sorteio do mesmo concurso (Dupla Sena tem 2; as demais sempre 1).';

ALTER TABLE public.lottery_draws
  DROP CONSTRAINT IF EXISTS lottery_draws_lottery_id_contest_number_key;
ALTER TABLE public.lottery_draws
  ADD CONSTRAINT lottery_draws_lottery_id_contest_number_sequence_key
  UNIQUE (lottery_id, contest_number, draw_sequence);

-- ============ novas modalidades (referência) ============

INSERT INTO public.lotteries (
  slug, name, short_name, universe_min, universe_max,
  min_selectable, max_selectable, base_selectable, color_key,
  sort_order, is_active, draws_per_contest,
  secondary_kind, secondary_label,
  secondary_universe_min, secondary_universe_max,
  secondary_min_selectable, secondary_max_selectable, secondary_base_selectable
) VALUES
  ('lotomania', 'Lotomania', 'Lotomania', 1, 100, 50, 50, 50, 'lotomania', 4, true, 1,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('dupla-sena', 'Dupla Sena', 'Dupla Sena', 1, 50, 6, 15, 6, 'dupla-sena', 5, true, 2,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('dia-de-sorte', 'Dia de Sorte', 'Dia de Sorte', 1, 31, 7, 15, 7, 'dia-de-sorte', 6, false, 1,
    'mes', 'Mês da Sorte', 1, 12, 1, 1, 1),
  ('timemania', 'Timemania', 'Timemania', 1, 80, 10, 15, 10, 'timemania', 7, false, 1,
    'time', 'Time do Coração', 1, 80, 1, 1, 1),
  ('mais-milionaria', '+Milionária', '+Milionária', 1, 50, 6, 12, 6, 'mais-milionaria', 8, false, 1,
    'trevo', 'Trevo da Sorte', 1, 6, 2, 6, 2),
  ('super-sete', 'Super Sete', 'Super Sete', 0, 9, 1, 7, 1, 'super-sete', 9, false, 1,
    NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ---- faixas de premiação ----
-- Lotomania: única modalidade com faixa de ZERO acertos premiada.
INSERT INTO public.lottery_prize_tiers (lottery_id, hits, label, sort_order)
SELECT id, 20, '20 acertos', 1 FROM public.lotteries WHERE slug = 'lotomania'
UNION ALL SELECT id, 19, '19 acertos', 2 FROM public.lotteries WHERE slug = 'lotomania'
UNION ALL SELECT id, 18, '18 acertos', 3 FROM public.lotteries WHERE slug = 'lotomania'
UNION ALL SELECT id, 17, '17 acertos', 4 FROM public.lotteries WHERE slug = 'lotomania'
UNION ALL SELECT id, 16, '16 acertos', 5 FROM public.lotteries WHERE slug = 'lotomania'
UNION ALL SELECT id, 15, '15 acertos', 6 FROM public.lotteries WHERE slug = 'lotomania'
UNION ALL SELECT id, 0, 'Nenhum acerto', 7 FROM public.lotteries WHERE slug = 'lotomania'
ON CONFLICT (lottery_id, hits) DO NOTHING;

-- Dupla Sena: mesmas faixas valem para os dois sorteios do concurso
-- (1º e 2º sorteio são conferidos separadamente pelo motor de
-- conferência, cada um contra seu próprio `lottery_draws.draw_sequence`).
INSERT INTO public.lottery_prize_tiers (lottery_id, hits, label, sort_order)
SELECT id, 6, 'Sena', 1 FROM public.lotteries WHERE slug = 'dupla-sena'
UNION ALL SELECT id, 5, 'Quina', 2 FROM public.lotteries WHERE slug = 'dupla-sena'
UNION ALL SELECT id, 4, 'Quadra', 3 FROM public.lotteries WHERE slug = 'dupla-sena'
ON CONFLICT (lottery_id, hits) DO NOTHING;

-- Dia de Sorte e Timemania: registradas aqui apenas as faixas por
-- QUANTIDADE DE DEZENAS (oficialmente independentes da seleção
-- secundária). A faixa do Mês da Sorte / Time do Coração — paga
-- independentemente do número de dezenas acertadas — entra junto
-- com o motor de seleção secundária, no PR dedicado a cada uma.
INSERT INTO public.lottery_prize_tiers (lottery_id, hits, label, sort_order)
SELECT id, 7, '7 acertos', 1 FROM public.lotteries WHERE slug = 'dia-de-sorte'
UNION ALL SELECT id, 6, '6 acertos', 2 FROM public.lotteries WHERE slug = 'dia-de-sorte'
UNION ALL SELECT id, 5, '5 acertos', 3 FROM public.lotteries WHERE slug = 'dia-de-sorte'
UNION ALL SELECT id, 4, '4 acertos', 4 FROM public.lotteries WHERE slug = 'dia-de-sorte'
ON CONFLICT (lottery_id, hits) DO NOTHING;

INSERT INTO public.lottery_prize_tiers (lottery_id, hits, label, sort_order)
SELECT id, 7, '7 acertos', 1 FROM public.lotteries WHERE slug = 'timemania'
UNION ALL SELECT id, 6, '6 acertos', 2 FROM public.lotteries WHERE slug = 'timemania'
UNION ALL SELECT id, 5, '5 acertos', 3 FROM public.lotteries WHERE slug = 'timemania'
UNION ALL SELECT id, 4, '4 acertos', 4 FROM public.lotteries WHERE slug = 'timemania'
UNION ALL SELECT id, 3, '3 acertos', 5 FROM public.lotteries WHERE slug = 'timemania'
ON CONFLICT (lottery_id, hits) DO NOTHING;

-- +Milionária e Super Sete: nenhuma faixa inserida ainda — a
-- premiação real da +Milionária é CONJUNTA (dezenas + trevos, não
-- redutível a uma única coluna `hits`) e a do Super Sete é por
-- colunas acertadas, não por dezenas de um pool único. Registrar
-- uma faixa parcial/aproximada aqui seria uma informação de
-- premiação incorreta — fica para quando o modelo de faixa conjunta
-- for implementado, junto com a seleção secundária/colunas.

-- ---- preços oficiais (sem valor inventado: combinações × aposta simples) ----
INSERT INTO public.lottery_prices (lottery_id, numbers_selected, combination_count, price, source)
SELECT id, 50, 1, 3.00, 'caixa' FROM public.lotteries WHERE slug = 'lotomania';

INSERT INTO public.lottery_prices (lottery_id, numbers_selected, combination_count, price, source)
SELECT id, v.n, v.c, v.price, 'caixa'
FROM public.lotteries, (VALUES
  (6, 1, 3.00), (7, 7, 21.00), (8, 28, 84.00), (9, 84, 252.00), (10, 210, 630.00),
  (11, 462, 1386.00), (12, 924, 2772.00), (13, 1716, 5148.00), (14, 3003, 9009.00), (15, 5005, 15015.00)
) AS v(n, c, price)
WHERE slug = 'dupla-sena';

INSERT INTO public.lottery_prices (lottery_id, numbers_selected, combination_count, price, source)
SELECT id, v.n, v.c, v.price, 'caixa'
FROM public.lotteries, (VALUES
  (7, 1, 2.50), (8, 8, 20.00), (9, 36, 90.00), (10, 120, 300.00), (11, 330, 825.00),
  (12, 792, 1980.00), (13, 1716, 4290.00), (14, 3432, 8580.00), (15, 6435, 16087.50)
) AS v(n, c, price)
WHERE slug = 'dia-de-sorte';

INSERT INTO public.lottery_prices (lottery_id, numbers_selected, combination_count, price, source)
SELECT id, v.n, v.c, v.price, 'caixa'
FROM public.lotteries, (VALUES
  (10, 1, 3.50), (11, 11, 38.50), (12, 66, 231.00), (13, 286, 1001.00), (14, 1001, 3503.50), (15, 3003, 10510.50)
) AS v(n, c, price)
WHERE slug = 'timemania';

-- +Milionária: só a coluna de preço no trevo-base (2 trevos, o
-- mínimo) entra aqui, para que qualquer consumidor genérico que
-- procure preço só por `numbers_selected` (ainda sem olhar
-- `secondary_selected`) continue encontrando exatamente uma linha
-- por quantidade de dezenas, sem ambiguidade. A matriz completa
-- (dezenas × trevos) entra no PR que liga a seleção de trevos de
-- verdade ao motor e à tela.
INSERT INTO public.lottery_prices (lottery_id, numbers_selected, secondary_selected, combination_count, price, source)
SELECT id, v.n, 2, v.c, v.price, 'caixa'
FROM public.lotteries, (VALUES
  (6, 1, 6.00), (7, 7, 42.00), (8, 28, 168.00), (9, 84, 504.00),
  (10, 210, 1260.00), (11, 462, 2772.00), (12, 924, 5544.00)
) AS v(n, c, price)
WHERE slug = 'mais-milionaria';

-- Super Sete: inativa, sem preços ainda — o eixo de preço não é
-- "dezenas de um pool", é "dígitos marcados por coluna", que pede
-- seu próprio modelo de geração antes de fazer sentido precificar.

-- ---- trava a sincronização automática das modalidades ainda sem adaptador ----
-- `claim_lottery_sync` só avança quando `lottery_sync_state.enabled` é
-- verdadeiro, e o estado é criado com enabled=true por padrão na primeira
-- execução agendada para qualquer linha de `lotteries` (mesmo inativa, já
-- que o agendador lista todas). Sem isto, o próximo ciclo agendado tentaria
-- buscar resultado oficial para modalidades cujo formato o adaptador ainda
-- não sabe interpretar: seleção secundária (Dia de Sorte/Timemania/
-- +Milionária), colunas (Super Sete), ou segundo sorteio do mesmo concurso
-- (Dupla Sena — `persist_official_draw` ainda grava só 1 sorteio por
-- concurso; estender para 2 fica para o PR dedicado da Dupla Sena, que
-- também muda essa função). Pré-criar o estado já desligado evita chamadas
-- e erros desnecessários até cada PR dedicado ligar a sincronização.
INSERT INTO public.lottery_sync_state (lottery_id, enabled, status)
SELECT id, false, 'WAITING_PUBLICATION'
FROM public.lotteries
WHERE slug IN ('dupla-sena', 'dia-de-sorte', 'timemania', 'mais-milionaria', 'super-sete')
ON CONFLICT (lottery_id) DO NOTHING;
