/**
 * Módulos da Administração e ações de permissão.
 * Mantido em sincronia com `public.access_modules()` no banco.
 */
export const permissionActions = ["view", "create", "edit", "delete"] as const;
export type PermissionAction = (typeof permissionActions)[number];

export const permissionActionLabel: Record<PermissionAction, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
};

export const accessModules = [
  { key: "usuarios", label: "Usuários", description: "Consultar e gerir contas." },
  { key: "atendimento", label: "Atendimento", description: "Chamados e contatos do site." },
  { key: "monitor", label: "Monitor", description: "Indicadores do sistema." },
  { key: "loterias", label: "Loterias", description: "Disponibilidade e clubes." },
  {
    key: "atualizacao",
    label: "Atualização automática",
    description: "Resultados e próximo sorteio.",
  },
  { key: "conferencia", label: "Conferência de jogos", description: "Fila e reprocessamento." },
  { key: "sistema", label: "Controle do sistema", description: "Modo manutenção." },
  { key: "auditoria", label: "Auditoria", description: "Registro de ações administrativas." },
] as const;
export type AccessModuleKey = (typeof accessModules)[number]["key"];

/** Tipos de acesso do sistema. Quem se cadastra é sempre USER; só ADMIN promove. */
export const accessRoles = ["USER", "SUPORTE", "ADMIN"] as const;
export type AccessRole = (typeof accessRoles)[number];

export const accessRoleLabel: Record<AccessRole, string> = {
  USER: "Usuário",
  SUPORTE: "Suporte",
  ADMIN: "Administrador",
};

export const accessRoleDescription: Record<AccessRole, string> = {
  USER: "Usa o aplicativo. Sem acesso à Administração.",
  SUPORTE: "Atende usuários. Vê apenas o que for liberado em Tipos de acesso.",
  ADMIN: "Acesso total. Sempre precisa existir pelo menos um ativo.",
};

export const roleChangeReasons = [
  { value: "ADMIN_REQUEST", label: "Solicitação do administrador" },
  { value: "TEAM_CHANGE", label: "Mudança de função na equipe" },
  { value: "SECURITY", label: "Segurança" },
  { value: "OTHER", label: "Outro" },
] as const;
export type RoleChangeReason = (typeof roleChangeReasons)[number]["value"];
