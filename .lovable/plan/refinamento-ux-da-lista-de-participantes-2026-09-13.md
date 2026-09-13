# Refinamento UX da lista de participantes

## Objetivo
Reorganizar as listas administrativa e pública em colunas estáveis, legíveis e responsivas, sem alterar dados, permissões ou regras do bolão.

## Implementação
- Criar uma apresentação tabular responsiva compartilhando apenas padrões visuais: três colunas reais para Participante, Cotas e Pagamento/Status em todos os tamanhos.
- Na área administrativa, manter detalhes e ações existentes, acrescentar busca, filtros pelos estados reais, contagens e ordenação simples por participante, cotas e pagamento.
- Na visão pública, manter exclusivamente os participantes já autorizados e o carregamento progressivo existente; remover a frase corrida e usar badge de pagamento.
- Truncar nomes longos sem deslocar cotas/status; disponibilizar o nome completo por título acessível onde aplicável.
- Usar singular/plural correto e componentes/tokens atuais para filtros, botões e badges.

## Validação
- Cobrir busca, filtros, ordenação, singular/plural, nomes longos e volumes de 23, 50, 100 e 200 participantes.
- Validar área administrativa e pública em 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900.
- Confirmar temas claro, escuro e automático, navegação por teclado, estado selecionado dos filtros e ausência estrutural de rolagem horizontal.
- Executar testes direcionados, suíte geral, verificação de tipos e compilação; conferir o cenário real Bolão Galera Gmill sem modificar seus dados.

## Limites
Nenhuma mudança em banco, consultas públicas, pagamentos, cotas, permissões, rateio, comprovantes, links ou PDF.
