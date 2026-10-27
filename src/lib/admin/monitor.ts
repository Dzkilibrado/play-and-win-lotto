/** Regras puras do Monitor: ordem, visibilidade e resumo. Sem rede e sem React. */
import {
  monitorItems,
  type MonitorItemDef,
  type MonitorLevel,
  type MonitorSnapshot,
} from "@/config/adminMonitor";

export interface MonitorPrefRow {
  item_key: string;
  enabled: boolean;
  position: number;
}

export interface MonitorEntry {
  item: MonitorItemDef;
  enabled: boolean;
}

/**
 * Junta o catálogo com as preferências salvas. Itens salvos vêm primeiro, na
 * ordem escolhida; itens novos do catálogo entram no fim com o padrão; chaves
 * que não existem mais são ignoradas.
 */
export function resolveMonitorEntries(
  prefs: readonly MonitorPrefRow[],
  catalog: readonly MonitorItemDef[] = monitorItems,
): MonitorEntry[] {
  const byKey = new Map(catalog.map((item) => [item.key, item]));
  const saved = [...prefs]
    .filter((row) => byKey.has(row.item_key))
    .sort((a, b) => a.position - b.position);
  const used = new Set<string>();
  const entries: MonitorEntry[] = [];
  for (const row of saved) {
    if (used.has(row.item_key)) continue;
    used.add(row.item_key);
    entries.push({ item: byKey.get(row.item_key)!, enabled: row.enabled });
  }
  for (const item of catalog) {
    if (!used.has(item.key)) entries.push({ item, enabled: item.defaultEnabled });
  }
  return entries;
}

export function moveEntry(entries: readonly MonitorEntry[], key: string, direction: -1 | 1) {
  const index = entries.findIndex((entry) => entry.item.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= entries.length) return [...entries];
  const next = [...entries];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function toggleEntry(entries: readonly MonitorEntry[], key: string): MonitorEntry[] {
  return entries.map((entry) =>
    entry.item.key === key ? { ...entry, enabled: !entry.enabled } : entry,
  );
}

export function toPrefRows(entries: readonly MonitorEntry[]): MonitorPrefRow[] {
  return entries.map((entry, position) => ({
    item_key: entry.item.key,
    enabled: entry.enabled,
    position,
  }));
}

export interface MonitorSummary {
  critical: number;
  attention: number;
  shown: number;
}

export function summarize(
  entries: readonly MonitorEntry[],
  snapshot: MonitorSnapshot,
  now: Date,
): MonitorSummary {
  let critical = 0;
  let attention = 0;
  let shown = 0;
  for (const entry of entries) {
    if (!entry.enabled) continue;
    shown += 1;
    const level: MonitorLevel = entry.item.read(snapshot, now).level;
    if (level === "critical") critical += 1;
    else if (level === "attention") attention += 1;
  }
  return { critical, attention, shown };
}
