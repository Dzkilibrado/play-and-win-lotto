/**
 * Filter Engine: registro, validação prévia, combinação (AND) e snapshot.
 */
import { filterDefinitions, countFeasibility, sumFeasibility } from "./definitions";
import {
  filterIds,
  generationRulesVersion,
  type FilterContext,
  type FilterId,
  type FilterIssue,
  type FilterStates,
  type GenerationConstraints,
} from "./types";

export * from "./types";
export { filterDefinitions, countFeasibility, sumFeasibility };

export function defaultFilterStates(): FilterStates {
  return {
    parity: { enabled: false, config: { ...filterDefinitions.parity.defaultConfig } },
    sum: { enabled: false, config: { ...filterDefinitions.sum.defaultConfig } },
    rows: { enabled: false, config: { ...filterDefinitions.rows.defaultConfig } },
    columns: { enabled: false, config: { ...filterDefinitions.columns.defaultConfig } },
    repeated: { enabled: false, config: { ...filterDefinitions.repeated.defaultConfig } },
    consecutive: { enabled: false, config: { ...filterDefinitions.consecutive.defaultConfig } },
    gapRun: { enabled: false, config: { ...filterDefinitions.gapRun.defaultConfig } },
    fibonacci: { enabled: false, config: { ...filterDefinitions.fibonacci.defaultConfig } },
    prime: { enabled: false, config: { ...filterDefinitions.prime.defaultConfig } },
  };
}

/** Filtros realmente atuando: ligados E configurados. */
export function activeFilterIds(states: FilterStates | null | undefined): FilterId[] {
  if (!states) return [];
  return filterIds.filter((id) => {
    const state = states[id];
    if (!state?.enabled) return false;
    const definition = filterDefinitions[id];
    return (definition.isConfigured as (config: unknown) => boolean)(state.config);
  });
}

export function validateFilters(
  states: FilterStates | null | undefined,
  context: FilterContext,
): FilterIssue[] {
  const issues: FilterIssue[] = [];
  for (const id of activeFilterIds(states)) {
    const definition = filterDefinitions[id];
    const state = states![id];
    issues.push(
      ...(definition.validateConfiguration as (config: unknown, ctx: FilterContext) => FilterIssue[])(
        state.config,
        context,
      ),
    );
  }
  return issues;
}

/** Combinação AND: o jogo só é aceito se atender TODOS os filtros ativos. */
export function buildCandidatePredicate(
  states: FilterStates | null | undefined,
  context: FilterContext,
): (numbers: number[]) => boolean {
  const active = activeFilterIds(states);
  if (!active.length) return () => true;
  const checks = active.map((id) => {
    const definition = filterDefinitions[id];
    const config = states![id].config;
    return (numbers: number[]) =>
      (
        definition.evaluateCandidate as (
          numbers: number[],
          config: unknown,
          ctx: FilterContext,
        ) => boolean
      )(numbers, config, context);
  });
  return (numbers: number[]) => checks.every((check) => check(numbers));
}

export interface FilterChip {
  id: FilterId;
  label: string;
  summary: string;
}

export function describeFilters(
  states: FilterStates | null | undefined,
  context: FilterContext,
): FilterChip[] {
  return activeFilterIds(states).map((id) => {
    const definition = filterDefinitions[id];
    return {
      id,
      label: definition.label,
      summary: (definition.explain as (config: unknown, ctx: FilterContext) => string)(
        states![id].config,
        context,
      ),
    };
  });
}

const MAX_LIMIT = 1000;

function sanitizeNumber(value: unknown, { allowZero = true } = {}): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (!allowZero && rounded <= 0) return null;
  if (rounded < 0 || rounded > MAX_LIMIT) return null;
  return rounded;
}

/**
 * Sanitização do payload de filtros — nunca confiar apenas na interface.
 * Valores fora de faixa viram null (filtro sem restrição naquele campo).
 */
export function sanitizeFilterStates(input: unknown): FilterStates {
  const states = defaultFilterStates();
  if (!input || typeof input !== "object") return states;
  const raw = input as Record<string, unknown>;
  for (const id of filterIds) {
    const entry = raw[id] as { enabled?: unknown; config?: unknown } | undefined;
    if (!entry || typeof entry !== "object") continue;
    const config = (entry.config ?? {}) as Record<string, unknown>;
    const target = states[id] as unknown as {
      enabled: boolean;
      config: Record<string, unknown>;
    };
    target.enabled = entry.enabled === true;
    for (const key of Object.keys(target.config)) {
      if (key === "reference") {
        target.config[key] =
          config[key] === "latest-draw" ? "latest-draw" : "previous-of-selected";
        continue;
      }
      target.config[key] = sanitizeNumber(config[key]);
    }
  }
  return states;
}

/** Snapshot estruturado e versionável salvo junto do jogo. */
export function buildConstraintsSnapshot(
  states: FilterStates | null | undefined,
): GenerationConstraints | null {
  const active = activeFilterIds(states);
  if (!active.length) return null;
  const filters = defaultFilterStates();
  for (const id of active) {
    (filters[id] as { enabled: boolean; config: unknown }).enabled = true;
    (filters[id] as { enabled: boolean; config: unknown }).config = {
      ...(states![id].config as object),
    };
  }
  return { version: generationRulesVersion, filters };
}
