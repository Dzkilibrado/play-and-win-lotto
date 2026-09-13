# Bolões — correção e compartilhamento público

- [x] Exibir PLANNED publicamente como Planejado; separar vinculados de apostas confirmadas.
- [x] Criar vínculo atômico em massa com validação integral de dono, modalidade, concurso e duplicidade.
- [x] Implementar seleção compacta em massa, seleção total, busca e contador dinâmico.
- [x] Criar links públicos independentes para Participantes, Jogos e Visão completa.
- [x] Restringir o payload público no banco conforme o escopo do token.
- [x] Atualizar gestão, mensagens e página pública para cada visão.
- [x] Cobrir 1/19/50/100 jogos, cenário real, segurança e responsividade.
- [x] Rodar testes, typecheck, build e sonda de integridade; documentar limitações.

## Ajuste final aprovado

- [x] Exibir PLANNED publicamente como Planejado nos escopos Jogos e Completo.
- [x] Separar jogos vinculados de apostas confirmadas nos resumos públicos.
- [x] Implementar alteração manual atômica de situação em massa.
- [x] Impedir situações exclusivas da conferência e validar ownership/transições.
- [x] Reproduzir o cenário real dos 19 jogos antes e depois da alteração.
- [x] Rodar testes, typecheck e validação responsiva.

## Correção funcional e UX de homologação

- [x] Cancelar o bolão antigo pelo fluxo oficial e preservar todo o histórico.
- [x] Unificar a classificação de vínculo dos jogos pela relação real em `pool_games`.
- [x] Impedir seleção de jogos já vinculados ou incompatíveis antes do envio.
- [x] Alinhar consultas, contadores e invalidações das telas privada e pública.
- [x] Reorganizar o compartilhamento com prévia e mensagens baseadas em dados reais.
- [x] Refinar os três tipos de página pública sem ampliar o payload.
- [x] Validar cenário real, seis resoluções, testes e tipos; acesso cruzado permanece protegido pelas regras existentes.
- [x] Entregar relatório final de 28 itens e aguardar homologação.

## Refinamento do compartilhamento e relatório PDF

- [x] Corrigir textos e unificar resumos de Participantes, Jogos e Completo.
- [x] Separar cancelamento, indisponibilidade e falha do compartilhamento nativo.
- [x] Gerar PDF administrativo completo somente sob demanda e sem armazenamento.
- [x] Validar privacidade, cenário real, seis resoluções, PDF, testes, tipos e build.
- [x] Entregar relatório final de 33 itens e aguardar homologação.

## Paginação e saldo do relatório PDF

- [x] Iniciar Jogos do bolão sempre em uma nova página.
- [x] Repetir o cabeçalho e manter cada linha de jogo indivisível.
- [x] Preservar Em aberto como valor a receber e adicionar Saldo do bolão.
- [x] Validar PDF real, volumes, testes, tipos e build.

## Comprovantes, arquivamento e exclusão definitiva

- [x] Criar armazenamento privado e metadados versionados para comprovantes.
- [x] Implementar anexar, editar, publicar, substituir, visualizar e excluir comprovantes.
- [x] Implementar arquivamento reversível e modo somente consulta.
- [x] Adicionar filtro e indicador de bolões arquivados sem alterar a Home.
- [x] Implementar exclusão definitiva com confirmação forte, auditoria e preservação dos jogos.
- [x] Exibir comprovantes publicados nas visões públicas Jogos e Completo.
- [x] Incorporar imagens e todas as páginas dos PDFs publicados ao relatório completo.
- [x] Validar testes, segurança, responsividade e PDF real.

## Correção da autenticação dos comprovantes

- [x] Rastrear o erro `exp` até o upload direto no armazenamento, separado da visualização.
- [x] Mover upload e substituição para operação autenticada no servidor, mantendo o armazenamento privado.
- [x] Preservar autorização por organizador/admin e remover arquivos novos quando o registro falhar.
- [x] Manter URLs temporárias restritas à visualização e acesso público somente por links Jogos/Completo válidos.
- [x] Validar PNG, JPG, PDF, publicação, edição, substituição, exclusão e relatório completo.
- [ ] Validar renovação real de uma sessão próxima da expiração (bloqueado: sessões de teste não fornecem refresh token reutilizável).

## Identidade, landing e acesso

- [x] Aplicar identidade Gestor da Sorte, temas, tipografia, SEO e PWA.
- [x] Criar landing pública com conteúdo institucional e próximos sorteios reais.
- [x] Redesenhar login e criar cadastro seguro, conclusão de perfil e perfil editável.
- [x] Implementar recuperação por e-mail e redefinição de senha.
- [x] Publicar Termos e Privacidade preliminares, versionar e registrar aceite.
- [x] Validar autenticação, segurança, temas e seis resoluções sem overflow.
- [x] Rodar testes, tipos e build; documentar limitações e aguardar homologação.

## Administrador principal e responsável do sistema

- [x] Localizar a conta existente, o perfil e os papéis atuais.
- [x] Preservar USER e atribuir ADMIN sem duplicidade.
- [x] Modelar o responsável principal em configuração institucional separada.
- [x] Manter papéis e responsável sem escrita disponível ao cliente.
- [x] Registrar promoção e designação no histórico administrativo.
- [x] Validar login real, acesso administrativo e bloqueio de usuário comum.

## Fechamento automático do menu mobile

- [x] Centralizar o estado do menu hambúrguer no cabeçalho compartilhado.
- [x] Fechar após qualquer destino final, inclusive a página atual.
- [x] Fechar também após mudanças de rota externas ao menu.
- [x] Validar seleção, toque externo e Escape nos quatro tamanhos solicitados.
- [x] Rodar testes, tipos e build sem regressões de navegação.

## Visualização estrutural de comprovantes

- [x] Auditar o arquivo real, metadados, bytes, autorização e todos os pontos de visualização.
- [x] Centralizar imagens, PDFs e fallback em um viewer reutilizável sem popups.
- [x] Endurecer validação de tipo, nome original e acesso privado/público temporário.
- [x] Corrigir incorporação de imagens, WEBP e PDFs multipágina no relatório completo.
- [x] Validar o cenário real, matriz de arquivos, temas, acessibilidade e resoluções solicitadas.
- [x] Rodar testes, tipos e build; documentar causas, resultados e limitações para homologação.
## Domínio oficial com WWW
- [x] Centralizar a URL pública oficial
- [x] Aplicar a compartilhamentos, PDFs e metadados
- [x] Verificar Participantes, Jogos, Completo e ações de compartilhamento
- [x] Implementar redirecionamento permanente sem WWW preservando rota, parâmetros e token
- [x] Confirmar o redirecionamento na publicação final após a nova versão entrar no ar

## Fechamento de pendências funcionais
- [x] Diagnosticar o comprovante real e corrigir sessão expirada antes de operações autenticadas.
- [x] Tornar nome original e versão atual atômicos; centralizar autorização pública do arquivo.
- [x] Publicar e validar o comprovante real nos fluxos privado, Jogos, Completo e PDF.
- [x] Homologar alteração de senha, ocultação de diagnósticos e menu mobile.
- [x] Executar matriz de formatos, volumes, telas, temas, testes, tipos e build.

## Refinamento UX da lista de participantes
- [x] Reorganizar as listas administrativa e pública em três colunas responsivas.
- [x] Adicionar busca, filtros reais e ordenação simples na área administrativa.
- [x] Preservar minimização pública e carregamento progressivo para listas grandes.
- [x] Validar cenário real, acessibilidade, temas e seis resoluções sem overflow.
- [x] Rodar testes, tipos e build; entregar relatório final de 27 itens.

## Regressão do comprovante no PDF e compartilhamento
- [x] Diagnosticar a regressão com o comprovante real do Bolão Galera Gmill.
- [x] Corrigir a incorporação de PDF e imagens sem mascarar falhas.
- [x] Adicionar seleção de participantes, jogos e comprovantes na geração do PDF.
- [x] Refinar a opção Completo e sua contagem de comprovantes publicados.
- [ ] Validar os três links, sete resoluções, testes, tipos e compilação.
