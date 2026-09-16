import { describe, expect, it } from "vitest";

import {
  activeOperationalPools,
  applyPoolView,
  filterPools,
  paginatePools,
  poolGroupOf,
  poolHasResult,
  poolSortOf,
  sortPools,
  statusesForGroup,
} from "./poolFilters";
import type { PoolRow } from "@/lib/services/poolService";
import type { PoolStatus } from "@/types/domain";

type Participant = PoolRow["pool_participants"][number];

function participant(patch: Partial<Participant> = {}): Participant {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: null,
    quotas: 1,
    amount_due: 10,
    total_paid: 10,
    payment_status: "PAID",
    status: "ACTIVE",
    eligible_for_prize_share: true,
    ...patch,
  } as Participant;
}

let seq = 0;
function pool(patch: Partial<PoolRow> = {}): PoolRow {
  seq += 1;
  return {
    id: `pool-${seq}`,
    owner_id: "owner-1",
    lottery_id: "l1",
    contest_id: null,
    contest_number: null,
    contest_number_planned: null,
    draw_date: null,
    draw_date_planned: null,
    name: `Bolão ${seq}`,
    quota_value: 10,
    total_quotas: 10,
    payment_deadline: null,
    status: "OPEN" as PoolStatus,
    notes: null,
    is_public: false,
    public_token: null,
    cancel_reason: null,
    closed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    lotteries: { slug: "mega-sena", name: "Mega-Sena", short_name: "Mega", color_key: "mega" },
    pool_participants: [participant()],
    pool_games: [],
    ...patch,
  } as PoolRow;
}

describe("grupos de situação", () => {
  it("reconhece apenas grupos válidos", () => {
    expect(poolGroupOf("ongoing")).toBe("ongoing");
    expect(poolGroupOf("qualquer")).toBe("all");
    expect(poolGroupOf(undefined)).toBe("all");
  });

  it("usa a mesma definição operacional da Home e exclui arquivados", () => {
    const active = pool({ status: "AWAITING_DRAW", archived_at: null });
    const archived = pool({ status: "OPEN", archived_at: "2026-09-14T00:00:00Z" });
    const finished = pool({ status: "FINISHED", archived_at: null });
    const rows = [active, archived, finished];
    expect(activeOperationalPools(rows)).toEqual([active]);
    expect(filterPools(rows, { group: "ongoing" })).toEqual([active]);
  });

  it("mapeia cada grupo para as situações reais", () => {
    expect(statusesForGroup("all")).toBeNull();
    expect(statusesForGroup("ongoing")).toContain("AWAITING_CHECK");
    expect(statusesForGroup("result")).toEqual(["CHECKED", "PRIZED"]);
    expect(statusesForGroup("finished")).toEqual(["FINISHED", "CANCELLED"]);
  });

  it("filtra pela situação do grupo", () => {
    const rows = [pool({ status: "OPEN" }), pool({ status: "PRIZED" }), pool({ status: "FINISHED" })];
    const withResult = pool({
      status: "PRIZED",
      pool_games: [{
        id: "pg-result",
        generated_games: { status: "PRIZED", game_check_results: { id: "r1", is_prized: true } },
      }],
    });
    const open = pool({ status: "OPEN" });
    const finished = pool({ status: "FINISHED" });
    expect(filterPools([open, withResult, finished], { group: "result" })).toEqual([withResult]);
    expect(filterPools([open, withResult, finished], { group: "ongoing" }).map((p) => p.status)).toEqual(["OPEN"]);
    expect(filterPools([open, withResult, finished], {})).toHaveLength(3);
  });

  it("deriva Com resultado da conferência real, inclusive após finalização", () => {
    const finishedWithResult = pool({
      status: "FINISHED",
      pool_games: [{
        id: "pg-finished",
        generated_games: { status: "NOT_PRIZED", game_check_results: { id: "r2", is_prized: false } },
      }],
    });
    const checkedStatusWithoutEmbeddedResult = pool({ status: "CHECKED" });
    expect(poolHasResult(finishedWithResult)).toBe(true);
    expect(filterPools([finishedWithResult, checkedStatusWithoutEmbeddedResult], { group: "result" })).toEqual([
      finishedWithResult,
      checkedStatusWithoutEmbeddedResult,
    ]);
  });

  it("mantém todo bolão não arquivado em Todos e dá cobertura a cada situação", () => {
    const statuses: PoolStatus[] = [
      "FORMING", "OPEN", "CLOSED", "AWAITING_DRAW", "AWAITING_CHECK",
      "CHECKED", "PRIZED", "FINISHED", "CANCELLED",
    ];
    const rows = statuses.map((status) => pool({ status, archived_at: null }));
    expect(filterPools(rows, { group: "all" })).toHaveLength(statuses.length);
    for (const row of rows) {
      const classified = ["ongoing", "result", "finished"].some((group) =>
        filterPools([row], { group }).length === 1,
      );
      expect(classified).toBe(true);
    }
  });
});

describe("filtros avançados", () => {
  it("oculta arquivados por padrão e combina o arquivo com a situação real", () => {
    const archived = pool({ archived_at: "2026-09-12T20:00:00Z", status: "FINISHED" });
    const active = pool({ archived_at: null, status: "FINISHED" });
    expect(filterPools([archived, active], {})).toEqual([active]);
    expect(filterPools([archived, active], { archived: "yes", status: "FINISHED" })).toEqual([archived]);
  });

  it("situação detalhada, jogos, premiados e pagamentos pendentes", () => {
    const pendente = pool({
      status: "OPEN",
      pool_participants: [participant({ payment_status: "PENDING" })],
    });
    const comJogos = pool({ status: "CLOSED", pool_games: [{ id: "g1", generated_games: null }] });
    const premiado = pool({ status: "PRIZED" });
    const rows = [pendente, comJogos, premiado];

    expect(filterPools(rows, { payment: "PENDING" })).toEqual([pendente]);
    expect(filterPools(rows, { games: "with" })).toEqual([comJogos]);
    expect(filterPools(rows, { games: "without" })).toEqual([pendente, premiado]);
    expect(filterPools(rows, { prize: "PRIZED" })).toEqual([premiado]);
    expect(filterPools(rows, { status: "CLOSED" })).toEqual([comJogos]);
  });

  it("organizados por mim e dos quais participo", () => {
    const meu = pool({ owner_id: "u1" });
    const alheio = pool({
      owner_id: "u2",
      pool_participants: [participant({ user_id: "u1" })],
    });
    const rows = [meu, alheio];

    expect(filterPools(rows, { scope: "owner", userId: "u1" })).toEqual([meu]);
    expect(filterPools(rows, { scope: "member", userId: "u1" })).toEqual([alheio]);
    expect(filterPools(rows, { scope: "member", userId: "u3" })).toEqual([]);
  });
});

describe("ordenações", () => {
  const a = pool({
    name: "Zebra",
    created_at: "2026-01-01T00:00:00.000Z",
    draw_date: "2026-03-10",
    status: "OPEN",
  });
  const b = pool({
    name: "Alfa",
    created_at: "2026-02-01T00:00:00.000Z",
    draw_date_planned: "2026-02-20",
    status: "PRIZED",
  });
  const c = pool({ name: "Meio", created_at: "2026-01-15T00:00:00.000Z", status: "OPEN" });
  const rows = [a, b, c];

  it("valida o identificador de ordenação", () => {
    expect(poolSortOf("prized")).toBe("prized");
    expect(poolSortOf("inexistente")).toBe("recent");
  });

  it("sorteio mais próximo deixa sem data no fim", () => {
    expect(sortPools(rows, "draw").map((p) => p.name)).toEqual(["Alfa", "Zebra", "Meio"]);
  });

  it("mais recentes, mais antigos e nome", () => {
    expect(sortPools(rows, "recent").map((p) => p.name)).toEqual(["Alfa", "Meio", "Zebra"]);
    expect(sortPools(rows, "oldest").map((p) => p.name)).toEqual(["Zebra", "Meio", "Alfa"]);
    expect(sortPools(rows, "name").map((p) => p.name)).toEqual(["Alfa", "Meio", "Zebra"]);
  });

  it("premiados primeiro", () => {
    expect(sortPools(rows, "prized")[0]?.name).toBe("Alfa");
  });

  it("não altera o array recebido", () => {
    const copy = [...rows];
    sortPools(rows, "name");
    expect(rows).toEqual(copy);
  });
});

describe("carregamento progressivo", () => {
  const rows = Array.from({ length: 45 }, (_, index) => index);

  it("mostra a primeira fatia e sinaliza que há mais", () => {
    const first = paginatePools(rows, 1, 20);
    expect(first.visible).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(first.nextPage).toBe(2);
  });

  it("acumula as fatias anteriores", () => {
    expect(paginatePools(rows, 2, 20).visible).toHaveLength(40);
    const last = paginatePools(rows, 3, 20);
    expect(last.visible).toHaveLength(45);
    expect(last.hasMore).toBe(false);
  });

  it("trata página inválida como a primeira", () => {
    expect(paginatePools(rows, 0, 20).visible).toHaveLength(20);
    expect(paginatePools(rows, Number.NaN, 20).visible).toHaveLength(20);
  });

  it.each([5, 20, 50, 100, 200])("mantém listas de %i itens previsíveis", (total) => {
    const items = Array.from({ length: total }, (_, index) => index);
    const pages = Math.max(1, Math.ceil(total / 20));
    const result = paginatePools(items, pages, 20);
    expect(result.visible).toHaveLength(total);
    expect(result.hasMore).toBe(false);
  });
});

describe("visão combinada", () => {
  it("filtra e ordena numa passada só", () => {
    const rows = [
      pool({ name: "B", status: "PRIZED", created_at: "2026-01-01T00:00:00.000Z", pool_games: [{ id: "b", generated_games: { status: "PRIZED", game_check_results: { id: "rb", is_prized: true } } }] }),
      pool({ name: "A", status: "CHECKED", created_at: "2026-02-01T00:00:00.000Z", pool_games: [{ id: "a", generated_games: { status: "NOT_PRIZED", game_check_results: { id: "ra", is_prized: false } } }] }),
      pool({ name: "C", status: "OPEN" }),
    ];
    expect(applyPoolView(rows, { group: "result", sort: "name" }).map((p) => p.name)).toEqual([
      "A",
      "B",
    ]);
  });
});
