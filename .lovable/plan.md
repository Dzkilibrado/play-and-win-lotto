# Bolões: comprovantes, arquivamento e exclusão definitiva

## Objetivo
Ampliar somente o módulo de Bolões com gestão completa de comprovantes, arquivamento reversível e exclusão definitiva segura. Regras financeiras, rateio, conferência, geração, Pesos Inteligentes, estatísticas, concursos e sincronização oficial permanecem inalterados.

## 1. Comprovantes dos jogos
- Criar um bucket privado exclusivo para comprovantes, aceitando JPG, JPEG, PNG e PDF, com limite de tamanho e acesso restrito ao organizador.
- Evoluir `pool_documents` com título amigável, descrição, ordem, publicação (`false` por padrão), atualização e exclusão lógica. Manter as regras de acesso atuais sem exposição anônima direta.
- Implementar operações protegidas para anexar múltiplos arquivos, editar metadados, publicar/despublicar, substituir e excluir.
- Na substituição, manter o mesmo identificador público do comprovante, trocar apenas o arquivo atual e registrar metadados da versão anterior e evento de auditoria. O arquivo antigo deixa de ser público e pode ser removido do armazenamento.
- Na exclusão, usar confirmação do Design System, ocultar imediatamente de administração ativa, links públicos e novos PDFs, remover o arquivo e registrar a ação.
- Transformar a seção Documentos em “Comprovantes dos jogos”, com totais anexados/publicados, lista compacta, visualização segura e ações Editar/Excluir. Em bolão arquivado, manter somente visualização.
- Adicionar comprovantes publicados apenas às visões públicas Jogos e Completo; Participantes continua sem comprovantes. A página pública continua somente leitura e entrega o arquivo por endpoint validado pelo token e escopo, sem tornar o bucket público.

## 2. PDF completo
- Buscar os comprovantes publicados no momento da geração, sem cache persistente do relatório.
- Acrescentar cada imagem publicada em página própria, preservando proporção e sem corte.
- Incorporar todas as páginas de cada PDF publicado ao final do relatório, também em páginas próprias.
- Manter o mesmo relatório para bolões ativos e arquivados; exibir apenas uma indicação discreta “Arquivado” no cabeçalho.
- Preservar paginação, saldo, participantes, jogos e resultado já homologados.

## 3. Arquivamento separado da situação
- Adicionar `archived_at` em `pools`; o status operacional continua intacto.
- Criar operação protegida e auditada para Arquivar/Restaurar, autorizando organizador ou administrador e sem alterar situação, pagamentos, jogos, links ou resultados.
- Bolão arquivado entra em modo consulta para conteúdo operacional. Continuam permitidos: leitura, PDF, compartilhamento, revogação/regeneração de links, histórico e restauração.
- Manter links públicos ativos durante o arquivamento.
- Atualizar o detalhe com ações contextuais: ativo mostra Editar/Situação/Arquivar; arquivado mostra Compartilhar/Gerar PDF/Restaurar. A exclusão fica isolada na Zona de risco.

## 4. Dashboard, listagem e filtros
- No módulo Bolões, adicionar o indicador clicável Arquivados; não adicionar bloco novo à Home principal.
- Ocultar arquivados da visão normal e mostrá-los quando o filtro de organização estiver selecionado.
- Manter filtros na URL e permitir combinar Arquivado com status operacional, modalidade, concurso, período, pagamentos e jogos.
- Usar opções selecionáveis, nunca digitação para status: Todos, Em andamento, Aguardando sorteio, Finalizados e Arquivados; situações detalhadas ficam em Mais filtros.
- Atualizar cards para mostrar situação real e selo Arquivado, além de participantes, jogos, concurso e resultado aplicável. O card inteiro permanece clicável.

## 5. Exclusão definitiva
- Criar Zona de risco separada das ações usuais.
- Antes da exclusão, carregar resumo real de participantes, jogos, pagamentos, comprovantes, rateios e resultados.
- Exigir digitação exata de `EXCLUIR`; botão destrutivo só habilita após confirmação.
- Revogar a exclusão direta da tabela para usuários comuns e concentrar o fluxo em uma operação protegida no servidor.
- Criar uma função transacional que valide organizador ou administrador, bloqueie o bolão, registre auditoria mínima fora das tabelas eliminadas e remova o bolão com todas as dependências próprias.
- Preservar `generated_games`: apagar somente os vínculos em `pool_games` e limpar referências legadas ao bolão, nunca os jogos independentes do usuário.
- Tratar participantes, pagamentos, vínculos, comprovantes e versões, rateios, histórico, links e demais dependências por cascatas verificadas ou exclusões explícitas na mesma transação.
- Registrar uma tarefa durável de limpeza dos arquivos antes de apagar as linhas; o servidor remove os objetos exclusivos do prefixo do bolão e marca a limpeza concluída. Falhas ficam registradas para nova tentativa, evitando órfãos silenciosos.
- Após sucesso, invalidar listas, indicadores e detalhe sem recarregar a sessão. Links públicos passam a retornar a mesma página amigável de indisponibilidade, sem revelar motivo.

## 6. Segurança e banco
- Preservar as políticas existentes e não ampliar leitura pública das tabelas.
- Novas funções validam identidade no backend e autorização por propriedade ou papel ADMIN; botões ocultos não são a barreira de segurança.
- Adicionar somente as permissões mínimas necessárias para o bucket privado e novas estruturas, com RLS fechado por padrão.
- Registrar eventos de upload, edição, publicação, substituição, exclusão, arquivamento, restauração e exclusão definitiva sem dados pessoais desnecessários.
- Aplicar toda mudança estrutural por migração e atualizar os tipos gerados usados pela aplicação.

## 7. Validação
- Testes unitários dos filtros, arquivamento separado do status, confirmação forte, metadados e composição do PDF.
- Testes integrados: anexar, editar, publicar, substituir, excluir e anexar novamente; validar páginas públicas e PDF após cada mudança.
- Cenários Arquivar e Restaurar verificando dados, links, PDF, contadores e modo consulta.
- Criar bolão de teste com participante, pagamento, jogo, comprovante, histórico e link; excluir e validar atomicidade, remoção das dependências, preservação do jogo e indisponibilidade do link.
- Segurança com usuário proprietário, administrador, outro usuário e visitante anônimo.
- Responsividade em 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900, incluindo auditoria de overflow horizontal.
- Rodar testes completos, verificação de tipos e build. Gerar PDF real com imagens e PDF anexado, renderizar todas as páginas e inspecionar visualmente.

## Entrega
Entregar o relatório solicitado em 37 itens, incluindo modelagem, operações, segurança, tabelas tratadas, testes, totais, regressões e limitações. Não iniciar outra funcionalidade e aguardar homologação.
