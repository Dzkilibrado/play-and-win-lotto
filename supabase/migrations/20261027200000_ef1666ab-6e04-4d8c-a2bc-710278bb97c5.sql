-- Ativa Dia de Sorte e Timemania, mas DESABILITADAS para os usuários.
--
-- A modalidade passa a existir para a administração (painel Modalidades) sem
-- aparecer nem aceitar jogos até o administrador habilitá-la: antes disso é
-- preciso (Timemania) cadastrar os clubes e (as duas) validar o primeiro
-- resultado real da Caixa. A sincronização continua desligada em
-- `lottery_sync_state` (definido na fundação).
--
-- Idempotente e sem efeito sobre quem já foi habilitado: só mexe em linhas
-- ainda inativas.
UPDATE public.lotteries
SET is_active = true,
    availability = 'DISABLED',
    availability_note = CASE slug
      WHEN 'timemania' THEN 'Aguardando cadastro dos clubes e validação do resultado oficial.'
      ELSE 'Aguardando validação do resultado oficial (Mês da Sorte).'
    END,
    availability_changed_at = now()
WHERE slug IN ('dia-de-sorte', 'timemania')
  AND is_active = false;
