# Refinamento do compartilhamento e relatório PDF do bolão

## Objetivo
Ajustar a linguagem e os resumos públicos, tornar o compartilhamento nativo previsível e adicionar um relatório PDF completo, criado somente quando o organizador solicitar.

## Compartilhamento e textos
- Confirmar a origem visual de “Apostata” e garantir o rótulo único **Apostado** para jogos individuais em todas as saídas públicas e no PDF.
- Substituir “jogos vinculados” por linguagem pública natural: **Jogos**, **Jogos do bolão**, **Todos apostados** ou a divisão entre apostados e planejados.
- Centralizar os números e mensagens dos três tipos de compartilhamento:
  - **Participantes:** participantes confirmados, cotas pagas e limite quando existir; sem jogos.
  - **Jogos:** total de jogos e situação agregada, eliminando redundância quando todos estiverem apostados.
  - **Completo:** participantes, cotas, jogos e situação do bolão; valores coletivos somente quando já autorizados para essa visão.
- Manter mensagens curtas, com nome do bolão, modalidade, concurso quando disponível, sorteio, resumo e link em linha própria.
- Atualizar a página pública para usar os mesmos termos e a mesma regra de resumo, preservando o payload mínimo de cada token.

## Compartilhamento nativo e fallbacks
- Detectar suporte real a `navigator.share` e contexto seguro antes de exibir a ação direta.
- Não mostrar erro quando o usuário cancelar a folha de compartilhamento.
- Quando o navegador não suportar compartilhamento direto, ocultar/desabilitar essa ação e exibir uma nota discreta; WhatsApp e as duas opções de cópia continuam disponíveis.
- Manter **Copiar mensagem e link** em destaque, com confirmação “Mensagem e link copiados”.
- Reservar erro amigável apenas para falha técnica verdadeira.

## Relatório PDF sob demanda
- Adicionar **Gerar PDF completo** dentro do diálogo Compartilhar, na seção “Outras opções”, somente para o organizador.
- Buscar o relatório apenas após o clique, usando as consultas privadas já protegidas para bolão, participantes ativos, jogos e resultado oficial; nenhuma rota pública nova, armazenamento permanente ou alteração de RLS.
- Gerar o PDF no navegador com uma biblioteca dedicada a documentos paginados, carregada sob demanda para não pesar a abertura do bolão.
- Montar um documento profissional com:
  - cabeçalho do bolão e situação em português;
  - concurso/sorteio, valor da cota, cotas e limite;
  - resumo financeiro coletivo: previsto, recebido, em aberto e custo dos jogos;
  - tabela de todos os participantes ativos, sem telefone, e-mail, observações, documentos ou identificadores;
  - todos os jogos em layout compacto e adaptado à modalidade, com status em português;
  - resultado somente quando houver conferência oficial, incluindo dezenas, acertos e prêmios existentes;
  - rodapé com geração em horário de São Paulo e página X de Y.
- Criar nome de arquivo legível a partir do nome do bolão e concurso ou data, sem identificadores técnicos.
- Reutilizar o mesmo arquivo gerado para **Visualizar**, **Compartilhar** e **Salvar** enquanto os dados não mudarem; compartilhar arquivo apenas quando o dispositivo suportar, mantendo visualizar/salvar como alternativas.

## Segurança e consistência
- O PDF usará somente dados privados já autorizados ao organizador; a opção não será exibida para quem apenas acompanha o bolão.
- Não alterar pagamentos, rateio, cotas, conferência, vínculos, RLS, tokens, Gerador, filtros, Pesos ou cálculos.
- Manter os três links independentes, seus escopos no backend, revogação/regeneração e ausência de dados privados nas páginas públicas.

## Testes e validação
- Adicionar testes unitários para textos, resumos mistos/todos apostados, ausência de concurso inventado, cancelamento/indisponibilidade do compartilhamento e nome do PDF.
- Validar o cenário real **Bolão Galera Gmill**: 23 participantes, 23 cotas, R$ 60 por cota, R$ 1.380 recebidos e 19 jogos.
- Gerar um PDF real e inspecionar visualmente todas as páginas, corrigindo cortes, sobreposições, quebras de tabela, dezenas e paginação.
- Cobrir 10/23/50/100/200 participantes e jogos com quantidades válidas de Mega-Sena, Lotofácil e Quina.
- Testar o fluxo em 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900, sem rolagem horizontal.
- Rodar testes direcionados e completos, verificação de tipos e build; entregar o relatório solicitado em 33 itens e então aguardar homologação.
