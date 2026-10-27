# Pendências do projeto

Pontos em aberto que exigem atenção. Atualizar ao resolver.

## Novas modalidades (expansão de 3 para 9)

### Dia de Sorte — mantida DESABILITADA
- Decisão do responsável: permanece desabilitada em Administração → Modalidades.
- Antes de habilitar: validar a sincronização do Mês da Sorte com um resultado real da Caixa (campo `nomeTimeCoracaoMesSorte` e faixa "Mês de Sorte" são suposições) e ligar `lottery_sync_state.enabled`.
- Regra a confirmar com a Caixa: em aposta com mais de 7 dezenas, o prêmio do Mês da Sorte é pago uma vez por jogo (assumido; não confirmado).

### Timemania — mantida DESABILITADA — NECESSITA ATENÇÃO
- Decisão do responsável: não depender de ação manual para manter os clubes; o correto é haver uma **fonte oficial para atualização automática** da lista de 80 clubes (muda a cada biênio, Portaria MESP nº 32/2026, vigência até 01/05/2028).
- Hoje o catálogo (`lottery_secondary_options`) está vazio e só é preenchido pelo painel "Clubes da Timemania" (manual). Sem clubes, ninguém cria jogo.
- A fazer: identificar a fonte oficial da lista (Caixa/Ministério do Esporte), automatizar a carga e a troca no fim da vigência, e validar que a grafia casa com `nomeTimeCoracaoMesSorte` do resultado.
- Também validar a sincronização do resultado antes de habilitar.

### Dupla Sena — mantida DESABILITADA
- Validar a leitura do 2º sorteio (`listaDezenasSegundoSorteio` é suposição) com payload real e ligar a sincronização.

### Ainda não iniciadas
- +Milionária (faixas combinadas com trevos, matriz completa de preços) — issue #9.
- Super Sete (gerador por colunas) — issue #10.
- Importação do histórico de concursos das modalidades novas (só a Lotomania tem o caminho ligado).


## Melhorias homologadas (análise dos 13 pontos)

- Pacote 1 em andamento: próximo sorteio para todas as modalidades (feito neste PR), Loterias com cartões informativos (feito), intervalo menor em falha (feito para o calendário; falta o mesmo para a importação de resultados), **Monitor configurável** (ADMIN/SUPORTE escolhem indicadores e ordem), Administração em cartões, "Recursos do sistema" com **modo manutenção geral** (desligar tudo com urgência).
- Bolão/Orçamento: a escolha de Mês, Time e Trevos deve ser 100% automática, sem pedir nada ao usuário (hoje essas modalidades ficam fora do fluxo por orçamento).
- Pendente: +Milionária ainda precisa de validação com resultado real (`trevosSorteados`).
