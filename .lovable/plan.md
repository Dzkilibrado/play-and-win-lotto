# Corrigir visualização estrutural de comprovantes

## Objetivo
Corrigir de ponta a ponta a visualização privada, pública e no relatório PDF, sem popups e sem alterar regras homologadas de bolões, autorização ou compartilhamento.

## Diagnóstico confirmado
- O `about:blank` vem dos fluxos assíncronos baseados em `window.open`, sujeitos a bloqueio e navegação tardia de URLs temporárias.
- O comprovante atual do Bolão Galera Gmill está fisicamente presente e acessível, com MIME e assinatura coerentes, mas os próprios bytes armazenados formam uma imagem verde uniforme; o conteúdo original não pode ser reconstruído.
- O relatório incorpora esses mesmos bytes, portanto reproduz fielmente o retângulo verde. Além disso, o pipeline confia no MIME informado pelo navegador, sem validar a assinatura real do arquivo.
- O usuário reenviará o arquivo original depois da correção para a validação final dos quatro fluxos.

## Implementação
- Criar um `DocumentViewer` reutilizável e acessível, aberto dentro da aplicação, com carregamento, erro, fechar/voltar, baixar e compartilhar quando disponível.
- Exibir JPG/JPEG, PNG e WEBP com proporção preservada; renderizar PDF multipágina com paginação e zoom dentro do viewer; apresentar fallback explícito para formato sem prévia.
- Usar o mesmo viewer na gestão privada e nos links públicos Jogos/Completo; manter Participantes sem comprovantes.
- Tornar “Visualizar” uma ação clara e permitir abrir pela área principal do comprovante, mantendo Editar, Substituir e Excluir separados.
- Centralizar obtenção e renovação da URL temporária privada; no público, conservar a validação do token, escopo, bolão, publicação e exclusão antes de servir o arquivo.
- Validar assinatura dos bytes no upload e na substituição, normalizar MIME/extensão/nome original e adicionar WEBP à lista explícita; rejeitar divergências e conteúdo inválido com mensagem segura.
- Corrigir o relatório para usar o tipo real validado, incorporar imagens compatíveis sem alteração de cor e anexar todas as páginas de PDFs; uma falha em um comprovante terá tratamento identificável sem gerar PDF vazio.
- Remover a visualização normal por popup, inclusive do relatório completo, mantendo download/compartilhamento como ações independentes.

## Segurança e dados
- Preservar armazenamento privado, RLS, autorização de organizador/admin, publicação, versionamento e escopos públicos existentes.
- Não usar chave privilegiada no navegador, não ampliar acesso público e não persistir URLs temporárias.
- Preservar o registro verde atual até o usuário substituí-lo pelo original; nenhuma reconstrução ou alteração silenciosa será feita.

## Validação
- Testar JPG/JPEG/PNG/WEBP, PDF de uma e várias páginas, múltiplos comprovantes, publicação/despublicação e substituição/versionamento.
- Validar privado, link Jogos, link Completo e relatório PDF com o arquivo original reenviado; confirmar ausência em Participantes.
- Cobrir 320×568, 360×800, 390×844, tablet e desktop; temas Claro/Escuro/Automático, teclado, foco, contraste, toque e ausência de rolagem horizontal.
- Rodar testes automatizados, tipos e build; entregar os 46 itens solicitados, incluindo causas raiz, resultados e limitações, e aguardar homologação.
