# Etapa 3 — Bloquear e desbloquear usuários

## Objetivo
Adicionar controle de acesso somente para ADMIN, preservando integralmente os dados e credenciais do usuário. Não incluir reset de senha, exclusão, alteração de papel ou edição de perfil.

## Modelo e regras
- Usar o bloqueio nativo já refletido por `banned_until`; não criar um estado paralelo de conta.
- Manter os estados reais existentes: Ativo, Pendente de confirmação e Bloqueado. Não criar fluxo de “Liberar acesso”, pois Pendente é confirmação de cadastro, não aprovação administrativa.
- Bloquear e desbloquear somente pelo servidor, após validar sessão, papel ADMIN, existência do alvo e operação permitida.
- Impedir auto-bloqueio e bloqueio do `system_owner_user_id`, sem depender de e-mail.
- Verificar que a operação não deixa o sistema sem ADMIN ativo; a proteção permanece server-side mesmo que a interface esconda a ação.
- Não alterar senha, e-mail, providers, papéis, perfil ou qualquer registro funcional.

## Servidor, sessão e auditoria
- Criar operação administrativa única e validada para bloquear/desbloquear a conta usando a administração de autenticação apenas no servidor.
- Registrar `USER_BLOCKED` e `USER_UNBLOCKED` em `audit_logs`, contendo somente ator, alvo, ação, data e motivo opcional.
- Aceitar os motivos previstos sem ampliar o perfil do usuário; “Outro” exigirá descrição curta.
- Adicionar verificação reutilizável de conta bloqueada às operações autenticadas, para que uma sessão já aberta perca acesso na próxima requisição protegida.
- Reforçar a entrada da área autenticada para remover a sessão local e levar ao login com mensagem amigável, sem detalhes internos.
- Mapear o erro de login de conta bloqueada para “Seu acesso ao Gestor da Sorte está temporariamente indisponível.”

## Administração → Usuários
- Incluir ação textual “Bloquear acesso” para conta ativa e “Desbloquear acesso” para conta bloqueada.
- Não oferecer bloqueio para o próprio ADMIN nem para o responsável principal; identificá-lo como “Responsável principal” quando necessário.
- Usar diálogo do Design System com confirmação, explicação sobre preservação dos dados e motivo opcional.
- Atualizar imediatamente linha/card, indicadores e filtros por invalidação da consulta administrativa; nenhuma recarga manual.
- Manter cards compactos no celular e uma ação discreta na tabela desktop, sem criar tela de detalhes.
- Preservar a minimização do payload: nenhum telefone, nascimento, jogo, bolão, pagamento, documento, token ou dado técnico adicional.

## Validação
- Cobrir bloqueio por ADMIN, login recusado, sessão já aberta recusada, desbloqueio e novo login.
- Cobrir chamadas diretas por USER, auto-bloqueio, responsável principal e proteção do último ADMIN.
- Confirmar atualização de filtros/contadores sem refresh e auditoria mínima.
- Validar 320×568, 360×800, 390×844, tablet e desktop, nos temas Claro, Escuro e Automático, sem rolagem horizontal.
- Executar testes focados e completos, verificação de tipos e build.

## Fora de escopo
Reset de senha, exclusão de usuários, alteração/promoção de papel, edição de dados pessoais e mudanças nos demais módulos do Gestor da Sorte.
