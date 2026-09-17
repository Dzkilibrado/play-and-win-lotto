# Etapa 2 — Gestão básica de usuários

## Objetivo
Adicionar ao painel administrativo uma área somente de consulta para usuários cadastrados, preservando integralmente a segregação ADMIN × USER da Etapa 1.

## Implementação
- Criar uma consulta administrativa protegida que valida a role ADMIN no servidor antes de ler qualquer conta.
- Retornar somente nome, e-mail já mascarado, role, estado real da conta, método de acesso, cadastro e último acesso. Nenhum e-mail completo ou dado pessoal adicional chegará ao navegador.
- Aplicar filtros, ordenação, contagens e paginação no banco, com 20 registros por página e total autoritativo independente da página carregada.
- Usar apenas estados reais disponíveis: Ativo, Pendente de confirmação e Bloqueado. Não criar estado Inativo.
- Expor apenas métodos de acesso realmente presentes nas contas; atualmente, E-mail/Senha. A estrutura aceitará múltiplos métodos quando eles existirem.
- Criar `/admin/users`, protegida pelo mesmo bloqueio ADMIN da área administrativa existente.
- Adicionar uma entrada textual “Usuários” dentro de Administração, sem expô-la na navegação de contas USER.
- Exibir indicadores compactos para Total, Ativos, USER e ADMIN, clicáveis para aplicar filtros.
- Adicionar filtros por seleção para estado, role, método, período de cadastro e último acesso, além das ordenações solicitadas.
- No celular, concentrar filtros adicionais em painel inferior e renderizar cards compactos; no desktop, usar tabela administrativa.
- Manter a listagem estritamente somente leitura, sem ações de bloqueio, senha, exclusão, edição ou role.

## Segurança e privacidade
- A rota rejeitará USER antes de renderizar a página.
- A consulta validará ADMIN independentemente da rota e negará chamadas diretas por USER.
- A resposta será limitada aos campos exibidos; telefone, nascimento, documentos, finanças, jogos, bolões, comprovantes, tokens e metadados técnicos ficarão ausentes.
- A consulta será isolada no cache pela identidade do ADMIN e pelos filtros/página.

## Validação
- Testar acesso e chamada direta como USER e ADMIN.
- Conferir contagens, filtros, ordenações, paginação e máscara de e-mail.
- Inspecionar o payload real para confirmar a minimização dos dados.
- Validar 320×568, 360×800, 390×844, 768×1024, 1280×720 e 1440×900 nos temas Claro, Escuro e Automático, sem rolagem horizontal.
- Executar testes focados e completos, verificação de tipos e compilação.

## Fora de escopo
Nenhuma ação de bloqueio/desbloqueio, reset de senha, exclusão, alteração de role, promoção a ADMIN, edição de perfil ou mudança em módulos não relacionados será criada.
