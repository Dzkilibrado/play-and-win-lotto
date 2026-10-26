# Roadmap

- [x] Corrigir login, navegação de bolão e Home compacta.
- [x] Auditar e implementar sincronização automática server-side, painel administrativo e testes.
- [x] Otimizar a sincronização com janelas adaptativas, retificação e medição de custo.
- [ ] Publicar e validar no domínio final; a automação já está ativa e aponta para o domínio publicado.
- [x] Refinar Criar jogo, separar Bolões em hub/listagem e tornar Organização visível.
- [x] Tornar Organização integralmente textual e remover ações de ciclo de vida do menu de três pontos.
- [x] Eliminar falsos estados vazios e isolar consultas privadas por sessão/usuário.
## Correção crítica — bolão após sorteio
- [x] Diagnosticar Bolão Galera Gmill sem alterar dados
- [x] Corrigir cobertura do HUB/listagens e contadores autoritativos
- [x] Garantir ciclo pós-sorteio e invalidações sem buracos
- [x] Adicionar testes de cobertura e ciclo controlado
- [x] Validar busca, mobile, overflow, testes e prévia
## Etapa 1 — segregação ADMIN × USER
- [x] Auditar roles, rotas, operações administrativas e RLS existentes
- [x] Bloquear a rota administrativa antes do carregamento de dados
- [x] Remover Administração dos menus de USER em desktop e mobile
- [x] Validar ADMIN, viewports, temas e segurança
- [x] Validar USER e trocas ADMIN ↔ USER

## Etapa 2 — gestão básica de usuários
- [x] Criar consulta administrativa mínima, paginada e protegida
- [x] Adicionar rota e navegação Administração → Usuários
- [x] Implementar indicadores, filtros, ordenação e layouts responsivos
- [x] Validar privacidade, USER/ADMIN, temas, viewports e ausência de overflow

## Etapa 3 — bloquear e desbloquear usuários
- [x] Validar modelo real de bloqueio, sessão ativa e proteções administrativas
- [x] Implementar operações protegidas de bloquear/desbloquear e auditoria
- [x] Integrar ações, confirmações, status, filtros, indicadores e invalidação na listagem
- [x] Validar ADMIN/USER, auto-bloqueio, responsável principal, sessão ativa e responsividade

## Etapa 4 — recuperação e redefinição de senha
- [x] Corrigir o fluxo público com resposta neutra, domínio oficial e tratamento seguro do link
- [x] Implementar disparo administrativo protegido somente para contas com senha local
- [x] Registrar auditoria mínima e preservar bloqueio, providers e credenciais
- [x] Validar limites e regras em testes, telas públicas, confirmação ADMIN, temas e viewports
- [ ] Homologar e-mail recebido e link oficial com conta de teste — depende de mensagem recebida e publicação
- [ ] Confirmar política hospedada, remetente e limites exatos — configurações não expostas pelas ferramentas
