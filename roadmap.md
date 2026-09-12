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

- [ ] Aplicar identidade Gestor da Sorte, temas, tipografia, SEO e PWA.
- [ ] Criar landing pública com conteúdo institucional e próximos sorteios reais.
- [ ] Redesenhar login e criar cadastro seguro, conclusão de perfil e perfil editável.
- [ ] Implementar recuperação por e-mail e redefinição de senha.
- [ ] Publicar Termos e Privacidade preliminares, versionar e registrar aceite.
- [ ] Validar autenticação, segurança, temas e seis resoluções sem overflow.
- [ ] Rodar testes, tipos e build; documentar limitações e aguardar homologação.
