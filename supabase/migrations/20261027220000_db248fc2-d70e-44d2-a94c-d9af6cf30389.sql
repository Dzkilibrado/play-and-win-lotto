-- Ativa a +Milionária, mas DESABILITADA para os usuários.
--
-- Passa a existir para a administração (painel Modalidades) sem aparecer nem
-- aceitar jogos até ser habilitada: antes disso é preciso validar o primeiro
-- resultado real da Caixa (campo dos trevos e rótulos das faixas conjuntas).
-- A sincronização continua desligada em `lottery_sync_state`.
--
-- Idempotente; só mexe em linha ainda inativa.
UPDATE public.lotteries
SET is_active = true,
    availability = 'DISABLED',
    availability_note = 'Aguardando validação do resultado oficial (trevos e faixas conjuntas).',
    availability_changed_at = now()
WHERE slug = 'mais-milionaria'
  AND is_active = false;
