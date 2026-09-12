# Refinamento de paginação e saldo no PDF do bolão

## Objetivo
Ajustar somente o relatório PDF para separar participantes e jogos por página, manter cada jogo indivisível e esclarecer o resumo financeiro com o saldo do bolão.

## Alterações
- Inserir quebra de página explícita e incondicional antes de **Jogos do bolão**.
- Manter a tabela de participantes paginável, inclusive para listas longas.
- Configurar a tabela de jogos para repetir o cabeçalho e impedir a divisão de uma linha de jogo entre páginas.
- Preservar **Em aberto** como o valor ainda não recebido dos participantes.
- Adicionar **Saldo do bolão = Total recebido − Custo dos jogos**, sem limitar valores negativos a zero.
- Exibir uma observação discreta quando o saldo for negativo, informando o valor necessário para cobrir os jogos.
- Manter resultado após os jogos, sem criar páginas vazias desnecessárias.

## Validação
- Adicionar testes estruturais para quebra explícita, cabeçalho repetido, linhas indivisíveis e saldos positivo, zero e negativo.
- Cobrir 5, 23, 50 e 100 participantes e cenários com muitos jogos.
- Gerar e inspecionar visualmente o PDF real do **Bolão Galera Gmill**, verificando paginação, rodapé e ausência de jogos cortados.
- Rodar a suíte completa, verificação de tipos e build.

## Limites
Nenhuma alteração em pagamentos, rateio, conferência, acesso, tokens, jogos, participantes ou outras funcionalidades fora do PDF.
