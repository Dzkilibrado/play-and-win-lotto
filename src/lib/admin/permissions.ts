import {
  accessModules,
  permissionActions,
  type AccessModuleKey,
  type PermissionAction,
} from "@/config/accessModules";

export interface ModulePermission {
  module: AccessModuleKey;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type PermissionMatrix = ModulePermission[];

const emptyRow = (module: AccessModuleKey): ModulePermission => ({
  module,
  view: false,
  create: false,
  edit: false,
  delete: false,
});

/** Garante uma linha por módulo conhecido, na ordem do catálogo, e a coerência "criar/editar/excluir exige ver". */
export function normalizeMatrix(raw: unknown): PermissionMatrix {
  const rows = Array.isArray(raw) ? (raw as Partial<ModulePermission>[]) : [];
  return accessModules.map(({ key }) => {
    const found = rows.find((row) => row?.module === key);
    const row = { ...emptyRow(key), ...(found ?? {}), module: key };
    const any = row.create || row.edit || row.delete;
    return {
      module: key,
      view: Boolean(row.view || any),
      create: Boolean(row.create),
      edit: Boolean(row.edit),
      delete: Boolean(row.delete),
    };
  });
}

/** Liga ou desliga uma permissão mantendo a coerência: desligar "ver" desliga o resto; ligar qualquer ação liga "ver". */
export function setPermission(
  matrix: PermissionMatrix,
  module: AccessModuleKey,
  action: PermissionAction,
  value: boolean,
): PermissionMatrix {
  return matrix.map((row) => {
    if (row.module !== module) return row;
    if (action === "view" && !value) return emptyRow(module);
    const next = { ...row, [action]: value };
    if (value) next.view = true;
    return next;
  });
}

export function countGranted(matrix: PermissionMatrix): number {
  return matrix.reduce(
    (total, row) => total + permissionActions.filter((action) => row[action]).length,
    0,
  );
}

export function sameMatrix(a: PermissionMatrix, b: PermissionMatrix): boolean {
  return JSON.stringify(normalizeMatrix(a)) === JSON.stringify(normalizeMatrix(b));
}

export function canAct(
  matrix: PermissionMatrix,
  module: AccessModuleKey,
  action: PermissionAction,
): boolean {
  return matrix.find((row) => row.module === module)?.[action] ?? false;
}
