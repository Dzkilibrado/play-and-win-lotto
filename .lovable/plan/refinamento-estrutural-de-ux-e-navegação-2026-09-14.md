# Refinamento estrutural de UX e navegação

## Objetivo
Reorganizar Criar jogo, Bolões e Organização sem alterar regras financeiras, geração, participantes, pagamentos, comprovantes, PDF, conferência, sincronização ou permissões.

## Criar jogo
- Remover o comportamento fixo do resumo e o espaço extra reservado para ele no fim da página.
- Manter o resumo como último bloco do formulário, depois de filtros e pesos, com valor por jogo, quantidade e valor total atualizados pelas mesmas fontes atuais.
- Tornar a ação final explícita como “Criar 1 jogo” ou “Criar N jogos”, mantendo validações, mensagens, cancelamento e geração existentes.
- No desktop, usar um resumo final bem distribuído, sem rolagem interna nem coluna fixa.

## Bolões como hub e listagem separada
- Transformar `/pools` em um hub compacto com “Criar bolão” e cartões inteiros clicáveis para Todos, Em andamento, Aguardando sorteio, Com resultado, Finalizados e Arquivados.
- Calcular os totais com as situações reais já existentes; “Aguardando sorteio” usará `AWAITING_DRAW` e não criará novo estado.
- Criar `/pools/list` para busca, filtros, ordenação, quantidade encontrada e carregamento progressivo; cada cartão do hub abrirá essa tela com o filtro correspondente, mesmo quando houver somente um resultado.
- Preservar a consulta autorizada atual e o carregamento progressivo de 20 itens. Como filtros agregados dependem de participantes/jogos e o hub precisa dos totais globais, não será criada uma mudança de banco nesta rodada.
- Transportar busca, filtros, ordenação e página ao abrir um bolão; o botão visível de voltar retornará à listagem filtrada. Acesso direto ao detalhe continuará voltando ao hub.
- Atualizar entradas “Voltar/Cancelar” de criação e exclusão para destinos coerentes com o novo hub/listagem.

## Organização visível no bolão
- Adicionar “Organização” à navegação textual de seções do detalhe.
- Exibir nessa seção a situação do bolão separada de arquivamento e exclusão.
- Mostrar “Arquivar bolão” ou “Restaurar bolão” com explicação clara; colocar “Excluir definitivamente” em uma Zona de risco visível.
- Manter o menu “...” como atalho de conveniência, nunca como único acesso.
- Reutilizar confirmações, motivos obrigatórios, permissões e invalidações já existentes.

## Descoberta e navegação
- Garantir títulos, retorno textual e destinos claros nos fluxos alterados.
- Manter cartões inteiros clicáveis, áreas de toque adequadas e filtros avançados em “Mais filtros”.
- Evitar rolagem horizontal e qualquer novo elemento fixo no mobile.

## Validação
- Adicionar testes para categorias reais do hub, destinos filtrados, carregamento de 5/20/50/100/200 itens, preservação do contexto e descoberta de Organização sem o menu “...”.
- Cobrir o resumo final de Criar jogo, atualização dos valores e rótulo dinâmico do botão sem alterar a geração.
- Validar 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900; temas claro, escuro e automático; zero overflow horizontal.
- Executar suíte completa, verificação de tipos e compilação, registrando limitações reais no retorno solicitado de 39 itens.
