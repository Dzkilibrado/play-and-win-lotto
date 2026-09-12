# Ajuste final de jogos em bolões

## Objetivo
Exibir jogos planejados nos links públicos de Jogos e Visão completa, sempre com situação explícita, e permitir ao organizador alterar situações manuais de vários jogos com segurança.

## Implementação
- Atualizar o resumo público para incluir todos os jogos vinculados, mantendo contadores separados de jogos vinculados e apostas confirmadas.
- Exibir cada jogo com o rótulo amigável de sua situação e uma mensagem específica quando ainda houver jogos planejados.
- Manter os três escopos de compartilhamento e o payload mínimo atual.
- Adicionar seleção múltipla na área privada de jogos, com ação para escolher apenas situações manuais legítimas.
- Criar uma operação atômica no banco que bloqueie e valide todos os jogos antes de alterar qualquer um.
- Rejeitar jogos de outro proprietário, jogos fora do bolão e jogos já definidos pela conferência oficial.
- Nunca oferecer nem aceitar Conferido, Premiado ou Não premiado nessa operação.

## Validação
- Reproduzir 23 participantes e 19 jogos planejados: 19 vinculados, 0 apostas confirmadas, todos visíveis como Planejado.
- Alterar os 19 para Apostado em lote e confirmar no mesmo link: 19 vinculados, 19 apostas confirmadas.
- Testar os três links, vínculo em massa, privacidade, telas solicitadas e ausência de rolagem horizontal.
- Rodar toda a suíte, verificação de tipos e build.

## Fora do escopo
Não alterar conferência, rateio, pagamentos, cotas, tokens, RLS homologado nem qualquer outro módulo.
