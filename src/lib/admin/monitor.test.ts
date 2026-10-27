import { describe, expect, it } from "vitest";

import { monitorItems, type MonitorSnapshot } from "@/config/adminMonitor";

import { moveEntry, resolveMonitorEntries, summarize, toggleEntry, toPrefRows } from "./monitor";

const now = new Date("2026-10-27T12:00:00Z");
const calm: MonitorSnapshot = {
  sync_attention: 0,
  sync_late: 0,
  sync_max_failures: 0,
  sync_last_success: "2026-10-27T11:30:00Z",
  next_draw_failures: 0,
  check_failed_jobs: 0,
  check_queue: 0,
  lotteries_maintenance: 0,
  lotteries_disabled: 4,
  new_users_7d: 3,
  generated_at: now.toISOString(),
};

describe("resolveMonitorEntries", () => {
  it("sem preferências usa o padrão do catálogo", () => {
    const entries = resolveMonitorEntries([]);
    expect(entries).toHaveLength(monitorItems.length);
    expect(entries.find((e) => e.item.key === "check_queue")?.enabled).toBe(false);
    expect(entries.find((e) => e.item.key === "sync_attention")?.enabled).toBe(true);
  });
  it("respeita ordem e visibilidade salvas, ignora chave removida e acrescenta itens novos", () => {
    const entries = resolveMonitorEntries([
      { item_key: "new_users_7d", enabled: true, position: 0 },
      { item_key: "item_antigo", enabled: true, position: 1 },
      { item_key: "sync_attention", enabled: false, position: 2 },
    ]);
    expect(entries[0]?.item.key).toBe("new_users_7d");
    expect(entries[1]?.item.key).toBe("sync_attention");
    expect(entries[1]?.enabled).toBe(false);
    expect(entries.some((e) => e.item.key === "item_antigo")).toBe(false);
    expect(entries).toHaveLength(monitorItems.length);
  });
});

describe("edição", () => {
  it("move e liga/desliga sem sair dos limites", () => {
    const entries = resolveMonitorEntries([]);
    const first = entries[0]!.item.key;
    expect(moveEntry(entries, first, -1)[0]?.item.key).toBe(first);
    expect(moveEntry(entries, first, 1)[1]?.item.key).toBe(first);
    expect(toggleEntry(entries, first)[0]?.enabled).toBe(!entries[0]!.enabled);
    expect(toPrefRows(entries).map((r) => r.position)).toEqual(entries.map((_, i) => i));
  });
});

describe("indicadores", () => {
  it("tudo calmo = nenhum alerta", () => {
    const summary = summarize(resolveMonitorEntries([]), calm, now);
    expect(summary.critical + summary.attention).toBe(0);
  });
  it("falhas elevam o nível", () => {
    const sick = { ...calm, sync_attention: 1, sync_max_failures: 4, check_failed_jobs: 2 };
    const summary = summarize(resolveMonitorEntries([]), sick, now);
    expect(summary.critical).toBe(2);
    expect(summary.attention).toBe(1);
  });
  it("itens desligados não contam", () => {
    const entries = toggleEntry(resolveMonitorEntries([]), "sync_attention");
    const summary = summarize(entries, { ...calm, sync_attention: 3 }, now);
    expect(summary.critical).toBe(0);
  });
  it("sem registro de sucesso pede atenção, nunca 'ok'", () => {
    const item = monitorItems.find((i) => i.key === "sync_last_success")!;
    expect(item.read({ ...calm, sync_last_success: null }, now).level).toBe("attention");
  });
});
