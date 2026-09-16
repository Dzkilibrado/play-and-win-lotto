import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrations = new URL("../../../supabase/migrations/", import.meta.url);
const lifecycle = readFileSync(
  new URL("20260916213656_26b72f5f-731e-476f-82af-c5040883db1e.sql", migrations),
  "utf8",
);
const initial = readFileSync(
  new URL("20260916213520_9c521cee-8f4b-4567-8fc6-ee980b90b846.sql", migrations),
  "utf8",
);

describe("ciclo pós-sorteio dos bolões", () => {
  it("vincula o concurso pelos dados do bolão ou pelos jogos associados", () => {
    expect(lifecycle).toContain("p.contest_id = v_draw.id");
    expect(lifecycle).toContain("p.contest_number_planned = v_draw.contest_number");
    expect(lifecycle).toContain("g.contest_number = v_draw.contest_number");
  });

  it("mantém resultado pendente visível e só conclui com todas as conferências", () => {
    expect(lifecycle).toContain("v_next_status := 'AWAITING_CHECK'");
    expect(lifecycle).toContain("v_result_count = v_applicable_games");
    expect(lifecycle).toContain("'PRIZED'::public.pool_status");
    expect(lifecycle).toContain("'CHECKED'::public.pool_status");
  });

  it("não finaliza nem cancela automaticamente", () => {
    expect(lifecycle).not.toContain("v_next_status := 'FINISHED'");
    expect(lifecycle).not.toContain("v_next_status := 'CANCELLED'");
  });

  it("reage a resultado oficial, conferência e vínculo de jogo", () => {
    expect(initial).toContain("lottery_draws_reconcile_pool_lifecycle");
    expect(initial).toContain("game_check_results_reconcile_pool_lifecycle");
    expect(initial).toContain("pool_games_reconcile_pool_lifecycle");
  });

  it("expõe contadores autenticados sem misturar arquivamento e finalização", () => {
    expect(initial).toContain("CREATE OR REPLACE FUNCTION public.pool_hub_counts()");
    expect(initial).toContain("status IN ('FINISHED', 'CANCELLED')");
    expect(initial).toContain("archived_at IS NOT NULL");
    expect(initial).toContain("REVOKE ALL ON FUNCTION public.pool_hub_counts() FROM PUBLIC, anon");
  });
});