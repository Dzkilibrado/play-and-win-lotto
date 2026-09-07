/**
 * Filtros, ordenação e paginação da listagem de bolões.
 *
 * Tudo aqui é função pura sobre as linhas já autorizadas pelo banco (RLS):
 * o objetivo é ter um único lugar — testável — decidindo o que cada
 * filtro amigável significa em termos das situações reais do bolão.
 */
import type { PoolRow } from "@/lib/services/poolService";
import type { PoolStatus } from "@/types/domain";

export type PoolGroup = "all" | "ongoing" | "result" | "finished";

export const poolGroups: { id: PoolGroup; label: string; statuses: PoolStatus[] | null }[] = [
  { id: "all", label: "Todos", statuses: null },
  {
    id: "ongoing",
    label: "Em andamento",
    statuses: ["FORMING", "OPEN", "CLOSED", "AWAITING_DRAW", "AWAITING_CHECK"],
  },
  { id: "result", label: "Com resultado", statuses: ["CHECKED", "PRIZED"] },
  { id: "finished", label: "Finalizados", statuses: ["FINISHED", "CANCELLED"] },
];

export function poolGroupOf(value: string | undefined): PoolGroup {
  return poolGroups.some((group) => group.id === value) ? (value as PoolGroup) : "all";
}

export function poolGroupLabel(value: string | undefined): string {
  const id = poolGroupOf(value);
  return poolGroups.find((group) => group.id === id)?.label ?? "Todos";
}

/** Situações detalhadas oferecidas dentro de cada grupo. */
export function statusesForGroup(group: PoolGroup): PoolStatus[] | null {
  return poolGroups.find((item) => item.id === group)?.statuses ?? null;
}

export type PoolSort = "draw" | "recent" | "oldest" | "name" | "prized";

export const poolSortOptions: { id: PoolSort; label: string }[] = [
  { id: "draw", label: "Sorteio mais próximo" },
  { id: "recent", label: "Mais recentes" },
  { id: "oldest", label: "Mais antigos" },
  { id: "name", label: "Nome" },
  { id: "prized", label: "Premiados primeiro" },
];

export function poolSortOf(value: string | undefined): PoolSort {
  return poolSortOptions.some((option) => option.id === value) ? (value as PoolSort) : "recent";
}

export function poolSortLabel(value: string | undefined): string {
  const id = poolSortOf(value);
  return poolSortOptions.find((option) => option.id === id)?.label ?? "Mais recentes";
}

export interface PoolViewOptions {
  group?: string | undefined;
  status?: string | undefined;
  /** "PENDING" mostra apenas bolões com alguém devendo. */
  payment?: string | undefined;
  /** "with" | "without" */
  games?: string | undefined;
  /** "PRIZED" mostra apenas bolões premiados. */
  prize?: string | undefined;
  /** "owner" | "member" */
  scope?: string | undefined;
  sort?: string | undefined;
  /** Usuário atual, necessário para "organizados por mim"/"dos quais participo". */
  userId?: string | null | undefined;
}

const activeParticipants = (pool: PoolRow) =>
  pool.pool_participants.filter((participant) => participant.status === "ACTIVE");

export function poolHasPendingPayment(pool: PoolRow): boolean {
  return activeParticipants(pool).some(
    (participant) =>
      participant.payment_status === "PENDING" ||
      participant.payment_status === "PARTIAL" ||
      participant.payment_status === "OVERDUE",
  );
}

export function poolQuotasTaken(pool: PoolRow): number {
  return activeParticipants(pool).reduce((sum, participant) => sum + participant.quotas, 0);
}

export function poolActiveCount(pool: PoolRow): number {
  return activeParticipants(pool).length;
}

/** Data usada na ordenação por sorteio (real quando existe, senão a prevista). */
export function poolDrawDate(pool: PoolRow): string | null {
  return pool.draw_date ?? pool.draw_date_planned;
}

export function filterPools(rows: PoolRow[], options: PoolViewOptions): PoolRow[] {
  const group = poolGroupOf(options.group);
  const groupStatuses = statusesForGroup(group);

  return rows.filter((pool) => {
    if (groupStatuses && !groupStatuses.includes(pool.status)) return false;
    if (options.status && pool.status !== options.status) return false;
    if (options.payment === "PENDING" && !poolHasPendingPayment(pool)) return false;
    if (options.games === "with" && pool.pool_games.length === 0) return false;
    if (options.games === "without" && pool.pool_games.length > 0) return false;
    if (options.prize === "PRIZED" && pool.status !== "PRIZED") return false;
    if (options.scope === "owner" && pool.owner_id !== options.userId) return false;
    if (options.scope === "member") {
      const member = pool.pool_participants.some(
        (participant) => participant.user_id != null && participant.user_id === options.userId,
      );
      if (!member) return false;
    }
    return true;
  });
}

const time = (value: string | null) => (value ? new Date(value).getTime() : null);

export function sortPools(rows: PoolRow[], sort: string | undefined): PoolRow[] {
  const id = poolSortOf(sort);
  const copy = [...rows];

  const byRecent = (a: PoolRow, b: PoolRow) =>
    (time(b.created_at) ?? 0) - (time(a.created_at) ?? 0);

  switch (id) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    case "oldest":
      return copy.sort((a, b) => (time(a.created_at) ?? 0) - (time(b.created_at) ?? 0));
    case "prized":
      return copy.sort((a, b) => {
        const rank = (pool: PoolRow) => (pool.status === "PRIZED" ? 0 : 1);
        return rank(a) - rank(b) || byRecent(a, b);
      });
    case "draw":
      // Sorteio mais próximo primeiro; sem data definida vai para o fim.
      return copy.sort((a, b) => {
        const da = time(poolDrawDate(a));
        const db = time(poolDrawDate(b));
        if (da === null && db === null) return byRecent(a, b);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db || byRecent(a, b);
      });
    default:
      return copy.sort(byRecent);
  }
}

export function applyPoolView(rows: PoolRow[], options: PoolViewOptions): PoolRow[] {
  return sortPools(filterPools(rows, options), options.sort);
}

/** Carregamento progressivo: a página N mostra as N primeiras fatias. */
export function paginatePools<T>(rows: T[], page: number, pageSize: number) {
  const safePage = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1;
  const visible = rows.slice(0, safePage * pageSize);
  return { visible, hasMore: visible.length < rows.length, nextPage: safePage + 1 };
}
