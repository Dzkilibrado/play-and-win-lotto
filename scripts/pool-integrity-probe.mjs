/**
 * Sonda de integridade dos bolões contra o banco real (RLS + gatilhos + locks).
 *
 * Não faz parte da suíte de testes unitários porque precisa de rede e de uma
 * sessão autenticada. Executar com as variáveis do projeto carregadas:
 *
 *   set -a && . ./.env && set +a
 *   bun scripts/pool-integrity-probe.mjs
 *
 * Requer:
 *   LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN  sessão do usuário A (organizador)
 *   PROBE_TOKEN_B (opcional)               sessão de um segundo usuário
 *
 * A sonda cria bolões temporários chamados "ZZ Sonda", executa as tentativas
 * de burla e as corridas de concorrência, e remove tudo o que criou ao final.
 */
const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TOKEN_A = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
const TOKEN_B = process.env.PROBE_TOKEN_B;

if (!URL || !KEY || !TOKEN_A) {
  console.error("Faltam VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY ou o token do usuário A.");
  process.exit(1);
}

const headers = (token) => ({
  apikey: KEY,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

const call = async (token, path, init = {}) => {
  const res = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: headers(token) });
  const text = await res.text();
  return { status: res.status, body: text };
};
const rpc = (token, fn, args) =>
  call(token, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
const read = async (token, path) => JSON.parse((await call(token, path)).body || "[]");

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok, detail });
  console.log(`${ok ? "OK  " : "FALHA"} ${label} ${detail}`);
};

const me = await fetch(`${URL}/auth/v1/user`, { headers: headers(TOKEN_A) }).then((r) => r.json());
const lottery = (await read(TOKEN_A, "lotteries?select=id&limit=1"))[0];

const createdPools = [];
const createPool = async (totalQuotas) => {
  const row = JSON.parse(
    (
      await call(TOKEN_A, "pools", {
        method: "POST",
        body: JSON.stringify({
          owner_id: me.id,
          lottery_id: lottery.id,
          name: "ZZ Sonda",
          quota_value: 10,
          total_quotas: totalQuotas,
          contest_number_planned: 9999,
        }),
      })
    ).body,
  )[0];
  createdPools.push(row.id);
  return row;
};

const addTo = (poolId, name, quotas, extra = {}) =>
  rpc(TOKEN_A, "pool_add_participant", {
    _pool_id: poolId,
    _name: name,
    _phone: null,
    _quotas: quotas,
    _adjustment: 0,
    _adjustment_reason: null,
    _notes: null,
    _payment_mode: "PENDING",
    _payment_amount: null,
    _method: null,
    _method_description: null,
    _paid_at: null,
    ...extra,
  });

const setLimit = (poolId, total) =>
  rpc(TOKEN_A, "pool_update_details", { _pool_id: poolId, _patch: { total_quotas: total } });

const takenOf = async (poolId) =>
  (await read(TOKEN_A, `pool_participants?pool_id=eq.${poolId}&status=eq.ACTIVE&select=quotas`)).reduce(
    (sum, p) => sum + p.quotas,
    0,
  );
const limitOf = async (poolId) =>
  (await read(TOKEN_A, `pools?id=eq.${poolId}&select=total_quotas`))[0].total_quotas;

const invariant = async (poolId, label) => {
  const [limit, taken] = [await limitOf(poolId), await takenOf(poolId)];
  check(label, limit === null || taken <= limit, `comprometidas=${taken} limite=${limit}`);
};

const pool = await createPool(3);

try {
  const pid = JSON.parse((await addTo(pool.id, "ZZ Alvo", 1)).body);
  const patch = (body, token = TOKEN_A) =>
    call(token, `pool_participants?id=eq.${pid}`, { method: "PATCH", body: JSON.stringify(body) });

  check("A não forja payment_status", (await patch({ payment_status: "PAID" })).status === 403);
  check("A não forja total_paid", (await patch({ total_paid: 9999 })).status === 403);
  check("A não forja cancelamento", (await patch({ status: "CANCELLED" })).status === 403);
  check(
    "A não forja participação no rateio",
    (await patch({ eligible_for_prize_share: false, ineligible_reason: "x" })).status >= 400,
  );
  check("A edita campos livres do próprio bolão", (await patch({ name: "ZZ Alvo 2" })).status === 200);
  check(
    "RPC legítima continua funcionando",
    (await rpc(TOKEN_A, "pool_update_participant", { _participant_id: pid, _patch: { quotas: 2 } }))
      .status === 204,
  );

  /* -------- pagamentos -------- */
  const pay = await rpc(TOKEN_A, "pool_register_payment", {
    _participant_id: pid,
    _amount: 5,
    _paid_at: new Date().toISOString(),
    _method: "PIX",
    _notes: null,
    _allow_overpay: false,
    _method_description: null,
  });
  check("pagamento legítimo registrado", pay.status === 200);
  const payId = JSON.parse(pay.body);
  const state = (await read(TOKEN_A, `pool_participants?id=eq.${pid}&select=total_paid,payment_status`))[0];
  check("situação derivada do pagamento parcial", state.total_paid === 5 && state.payment_status === "PARTIAL");
  check(
    "pagamento não pode ser alterado direto",
    (await call(TOKEN_A, `pool_payments?id=eq.${payId}`, { method: "PATCH", body: JSON.stringify({ amount: 1 }) }))
      .status >= 400,
  );

  // P0: exclusão física direta do pagamento.
  const del = await call(TOKEN_A, `pool_payments?id=eq.${payId}`, { method: "DELETE" });
  const stillThere = (await read(TOKEN_A, `pool_payments?id=eq.${payId}&select=id`)).length === 1;
  check("DELETE direto de pagamento é recusado", del.status >= 400 && stillThere, `status=${del.status}`);

  check(
    "correção de pagamento pela RPC funciona",
    (await rpc(TOKEN_A, "pool_cancel_payment", { _payment_id: payId, _reason: "sonda" })).status === 204,
  );
  const afterCancel = (await read(TOKEN_A, `pool_payments?id=eq.${payId}&select=id,cancelled_at`))[0];
  check(
    "histórico do pagamento preservado após o estorno",
    !!afterCancel && afterCancel.cancelled_at !== null,
  );
  const backToPending = (await read(TOKEN_A, `pool_participants?id=eq.${pid}&select=total_paid,payment_status`))[0];
  check(
    "situação volta a pendente após o estorno",
    Number(backToPending.total_paid) === 0 && backToPending.payment_status !== "PAID",
  );

  const game = (await read(TOKEN_A, "generated_games?select=id&limit=1"))[0];
  if (game) {
    const forge = (body) =>
      call(TOKEN_A, `generated_games?id=eq.${game.id}`, { method: "PATCH", body: JSON.stringify(body) });
    check("A não forja situação PRIZED", (await forge({ status: "PRIZED" })).status === 403);
    check("A não forja acertos", (await forge({ hits: 6 })).status === 403);
    check("A não forja prêmio", (await forge({ prize_amount: 1_000_000 })).status === 403);
  }

  /* -------- CASO 1: inclusão × inclusão pela última cota -------- */
  const race = await Promise.all([addTo(pool.id, "ZZ B", 1), addTo(pool.id, "ZZ C", 1)]);
  const accepted = race.filter((r) => r.status === 200).length;
  check("CASO 1 — apenas uma inclusão vence a última cota", accepted === 1, `aceitas=${accepted}`);
  await invariant(pool.id, "CASO 1 — invariante de cotas");

  /* -------- CASO 2: redução de limite × inclusão -------- */
  for (let round = 0; round < 3; round += 1) {
    const p2 = await createPool(15);
    await addTo(p2.id, "ZZ base", 8);
    const [r1, r2] = await Promise.all([setLimit(p2.id, 10), addTo(p2.id, "ZZ novo", 5)]);
    await invariant(p2.id, `CASO 2 — invariante após redução × inclusão (rodada ${round + 1})`);
    check(
      `CASO 2 — operações serializadas (rodada ${round + 1})`,
      r1.status < 400 || r2.status < 400,
      `limite=${r1.status} inclusão=${r2.status}`,
    );
  }

  /* -------- CASO 3: redução de limite × aumento de cotas -------- */
  for (let round = 0; round < 3; round += 1) {
    const p3 = await createPool(15);
    await addTo(p3.id, "ZZ base", 7);
    const small = JSON.parse((await addTo(p3.id, "ZZ cresce", 1)).body);
    await Promise.all([
      setLimit(p3.id, 10),
      rpc(TOKEN_A, "pool_update_participant", { _participant_id: small, _patch: { quotas: 6 } }),
    ]);
    await invariant(p3.id, `CASO 3 — invariante após redução × aumento (rodada ${round + 1})`);
  }

  /* -------- CASO 4: bolão ilimitado × definição de limite -------- */
  for (let round = 0; round < 3; round += 1) {
    const p4 = await createPool(null);
    await addTo(p4.id, "ZZ base", 8);
    await Promise.all([setLimit(p4.id, 10), addTo(p4.id, "ZZ novo", 5)]);
    await invariant(p4.id, `CASO 4 — invariante ilimitado × definição de limite (rodada ${round + 1})`);
  }

  /* -------- CASO 5: duas alterações simultâneas de total_quotas -------- */
  const p5 = await createPool(15);
  await addTo(p5.id, "ZZ base", 8);
  const both = await Promise.all([setLimit(p5.id, 12), setLimit(p5.id, 9)]);
  const finalLimit = await limitOf(p5.id);
  check(
    "CASO 5 — estado final é um dos valores pedidos",
    [12, 9].includes(finalLimit),
    `limite=${finalLimit} status=${both.map((b) => b.status).join("/")}`,
  );
  await invariant(p5.id, "CASO 5 — invariante de cotas");

  /* -------- CASO 6: total_quotas NULL segue ilimitado -------- */
  const p6 = await createPool(null);
  const many = await Promise.all([
    addTo(p6.id, "ZZ i1", 50),
    addTo(p6.id, "ZZ i2", 50),
    addTo(p6.id, "ZZ i3", 50),
  ]);
  check(
    "CASO 6 — bolão sem limite aceita todas as inclusões",
    many.every((r) => r.status === 200) && (await takenOf(p6.id)) === 150,
  );
  check("CASO 6 — limite continua indefinido", (await limitOf(p6.id)) === null);

  /* -------- segundo usuário -------- */
  if (TOKEN_B) {
    check("B não lê o bolão de A", (await read(TOKEN_B, `pools?id=eq.${pool.id}&select=id`)).length === 0);
    const attempt = await patch({ name: "invadido" }, TOKEN_B);
    const stillA = (await read(TOKEN_A, `pool_participants?id=eq.${pid}&select=name`))[0];
    check(
      "B não altera participante de A",
      JSON.parse(attempt.body || "[]").length === 0 && stillA.name !== "invadido",
      stillA.name,
    );
    check(
      "B não usa a RPC no bolão de A",
      (await rpc(TOKEN_B, "pool_update_participant", { _participant_id: pid, _patch: { quotas: 9 } })).status >=
        400,
    );
    const payB = await rpc(TOKEN_B, "pool_register_payment", {
      _participant_id: pid,
      _amount: 1,
      _paid_at: new Date().toISOString(),
      _method: "PIX",
      _notes: null,
      _allow_overpay: false,
      _method_description: null,
    });
    check("B não registra pagamento no bolão de A", payB.status >= 400);
    check(
      "B não cancela pagamento do bolão de A",
      (await rpc(TOKEN_B, "pool_cancel_payment", { _payment_id: payId, _reason: "x" })).status >= 400,
    );
    const delB = await call(TOKEN_B, `pool_payments?id=eq.${payId}`, { method: "DELETE" });
    check(
      "B não apaga pagamento do bolão de A",
      (await read(TOKEN_A, `pool_payments?id=eq.${payId}&select=id`)).length === 1,
      `status=${delB.status}`,
    );
  } else {
    console.log("AVISO: PROBE_TOKEN_B não definido — testes de segundo usuário ignorados.");
  }
} finally {
  // Apagar o bolão remove participantes e pagamentos em cascata.
  for (const id of createdPools) await call(TOKEN_A, `pools?id=eq.${id}`, { method: "DELETE" });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
process.exit(failed.length === 0 ? 0 : 1);
