# Correção funcional e refinamento de Bolões

## Diagnóstico confirmado
- Existem dois bolões distintos do mesmo organizador:
  - **LotoFacil Independencia Gmill**, criado em 07/09: 1 participante ativo e pago, 0 jogos.
  - **Bolão Galera Gmill**, criado em 12/09: 23 participantes ativos e pagos, 23 cotas, R$ 1.380 recebidos e 19 jogos vinculados/apostados.
- Os 23 participantes e os 19 jogos não foram apagados nem movidos: estão no bolão recente escolhido como oficial.
- Os 19 jogos têm vínculo único em `pool_games` com o bolão oficial. Não há duplicidades nem vínculos órfãos.
- A contradição ocorre ao abrir o bolão antigo: sua tela privada mostra corretamente 1 participante e 0 jogos, mas o seletor busca todos os jogos do proprietário e só exclui vínculos com o bolão aberto. Assim, jogos vinculados ao outro bolão parecem elegíveis e a validação final os rejeita.
- A consulta privada de participantes não filtra por pagamento; ela retorna todos os registros do `pool_id` aberto. A página pública continua usando sua regra própria de publicação.

## Correção dos dados reais
- Manter **Bolão Galera Gmill** como o bolão oficial, sem recriar participantes ou jogos.
- Cancelar o bolão antigo pelo fluxo oficial, preservando seu participante, pagamento, eventos e auditoria.
- Não mover, duplicar ou apagar registros para fazer contadores coincidirem.

## Fonte única e vínculo em massa
- Fazer a classificação de candidatos partir do vínculo real em `pool_games`, validado no backend para o proprietário autenticado.
- Classificar cada jogo como: disponível, já vinculado a este bolão, vinculado a outro bolão, incompatível ou inelegível.
- Exibir jogos já vinculados com checkbox desativado; “Selecionar todos os elegíveis” incluirá apenas os realmente disponíveis.
- Manter a RPC atômica como validação final contra concorrência e preservar as regras de propriedade, modalidade, concurso e situação.
- Remover a perda silenciosa causada pelo vínculo interno da consulta privada de jogos e alinhar listagem, detalhe e invalidações de cache às mesmas chaves.

## Contadores e consultas
- Preservar consultas privadas e públicas separadas: gestão mostra todos os participantes ativos do bolão; links públicos mostram apenas o payload autorizado por cada visão.
- Derivar participantes, cotas, recebido, em aberto, jogos vinculados, custo e apostas confirmadas das respectivas consultas reais do bolão aberto.
- Atualizar explicitamente os caches da lista, detalhe, participantes, jogos e compartilhamento após cada alteração relevante.

## Compartilhamento
- Reorganizar o diálogo com a pergunta “O que você quer compartilhar?” e três seletores exclusivos: Participantes, Jogos e Completo.
- Mostrar uma prévia curta com números reais antes das ações.
- Separar visualmente as ações “Compartilhar”, “WhatsApp”, “Copiar mensagem e link” e “Copiar somente o link”.
- Gerar mensagens compactas com nome, modalidade, concurso quando existente, data, contadores reais, chamada e link em linha própria.
- Manter a última opção usada por bolão apenas durante a sessão.
- Preservar tokens independentes, escopo definido no backend, revogação/regeneração separadas e payload mínimo.

## Páginas públicas
- Identificar claramente “Visão de participantes”, “Visão dos jogos” ou “Acompanhamento completo”.
- Manter resumo e seções separadas para participantes, jogos e resultado.
- Exibir `PLANNED` como Planejado e `BET` como Apostado, com uma única nota curta sobre jogos planejados.
- Reduzir o texto de privacidade para uma nota discreta e manter o convite ao aplicativo como ação secundária.

## Validação
- Confirmar no banco e na interface o bolão oficial com 23 participantes, 23 cotas, R$ 1.380 recebidos e 19 jogos vinculados/apostados.
- Confirmar que o bolão antigo cancelado não captura mais o fluxo principal e preserva histórico.
- Testar os três links e mensagens, vínculo ao mesmo bolão, vínculo a outro bolão, incompatibilidade, seleção total e concorrência entre leitura e envio.
- Testar usuário A × usuário B, privacidade dos payloads e ausência de ampliação ao alterar a URL.
- Validar 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900 sem rolagem horizontal.
- Rodar testes novos, suíte completa, verificação de tipos e build; entregar o relatório solicitado em 28 itens.

## Fora do escopo
Não alterar pagamentos, rateio, cotas, conferência oficial, geração, pesos, estatísticas, concursos, Home, Design System, sincronização ou importação por foto.