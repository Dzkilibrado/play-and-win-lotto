# Etapa 1 — Segregação ADMIN × USER

## Objetivo
Fechar a fronteira entre usuários comuns e a administração já existente, sem criar gestão de usuários ou qualquer novo módulo administrativo.

## Implementação
- Mapear a única superfície administrativa atual (`/admin`) e todos os seus acessos, dados, funções e RPCs.
- Resolver a role no acesso autenticado usando `auth.uid()` + `user_roles`/`has_role`, preservando `system_owner_user_id` e sem regras por e-mail.
- Bloquear `/admin` antes da renderização e antes de qualquer consulta administrativa; exibir um destino seguro e não técnico para USER.
- Filtrar a entrada “Administração” em toda navegação desktop e mobile a partir da role validada, sem deixar espaços ou itens residuais.
- Manter as operações administrativas existentes protegidas novamente no servidor, inclusive sincronização e conferência manual.
- Restringir por RLS/grants os dados técnicos usados apenas pela administração, sem ampliar permissões e sem alterar a automação.
- Garantir limpeza de cache administrativo no logout e na troca de identidade.

## Validação
- Testes automatizados para menu, guard de rota, role e proteção das funções administrativas.
- Testes reais com USER e ADMIN para URL direta, chamadas administrativas e troca ADMIN ↔ USER.
- Verificação visual em 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900, nos temas Claro, Escuro e Automático, sem overflow horizontal.
- Executar testes, typecheck, build e revisão de segurança/RLS.

## Fora do escopo
Gestão, bloqueio, exclusão ou reset de usuários; edição de roles; novos administradores; novos módulos administrativos; alterações nas funcionalidades comuns.
