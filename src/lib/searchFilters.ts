/**
 * Filtros de listagem transportados por query params.
 * Isso preserva busca/filtros/ordenação ao entrar num registro e voltar.
 */
export interface ListSearch {
  q?: string;
  lottery?: string;
  contest?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: number;
  scope?: string;
  payment?: string;
  prize?: string;
  numbers?: string;
  tab?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function validateListSearch(search: Record<string, unknown>): ListSearch {
  const result: ListSearch = {};
  const keys = [
    "q",
    "lottery",
    "contest",
    "status",
    "from",
    "to",
    "sort",
    "scope",
    "payment",
    "prize",
    "numbers",
    "tab",
  ] as const;
  for (const key of keys) {
    const value = str(search[key]);
    if (value !== undefined) result[key] = value;
  }
  const page = Number(search["page"]);
  if (Number.isFinite(page) && page > 1) result.page = page;
  return result;
}

export function countActiveFilters(search: ListSearch) {
  return Object.entries(search).filter(([key, value]) => key !== "page" && value).length;
}
