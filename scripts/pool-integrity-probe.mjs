/**
 * Sonda de integridade dos bolões contra o banco real (RLS + gatilhos).
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
 * A sonda cria um bolão temporário chamado "ZZ Sonda", executa as tentativas
 * de burla e remove tudo o que criou ao final.
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
  return { status: res.status, body: text.slice(0, 200) };
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

const pool = JSON.parse(
  (
    await call(TOKEN_A, "pools", {
      method: "POST",
      body: JSON.stringify({
        owner_id: me.id,
        lottery_id: lottery.id,
        name: "ZZ Sonda",
        quota_value: 10,
        total_quotas: 3,
        contest_number_planned: 9999,
      }),
    })
  ).body,
)[0];

const addParticipant = (name, quotas, extra = {}) =>
  rpc(TOKEN_A, "pool_add_participant", {
    _pool_id: pool.id,
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

try {
  const pid = JSON.parse((await addParticipant("ZZ Alvo", 1)).body);
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
  check("situação derivada do pagamento", state.total_paid === 5 && state.payment_status === "PARTIAL");
  check(
    "pagamento não pode ser alterado direto",
    (await call(TOKEN_A, `pool_payments?id=eq.${payId}`, { method: "PATCH", body: JSON.stringify({ amount: 1 }) }))
      .status === 403,
  );
  check(
    "correção de pagamento pela RPC funciona",
    (await rpc(TOKEN_A, "pool_cancel_payment", { _payment_id: payId, _reason: "sonda" })).status === 204,
  );

  const game = (await read(TOKEN_A, "generated_games?select=id&limit=1"))[0];
  if (game) {
    const forge = (body) =>
      call(TOKEN_A, `generated_games?id=eq.${game.id}`, { method: "PATCH", body: JSON.stringify(body) });
    check("A não forja situação PRIZED", (await forge({ status: "PRIZED" })).status === 403);
    check("A não forja acertos", (await forge({ hits: 6 })).status === 403);
    check("A não forja prêmio", (await forge({ prize_amount: 1_000_000 })).status === 403);
  }

  // Concorrência pela última cota: sobra 1 cota, duas inclusões simultâneas.
  const race = await Promise.all([addParticipant("ZZ B", 1), addParticipant("ZZ C", 1)]);
  const accepted = race.filter((r) => r.status === 200).length;
  const quotas = (await read(TOKEN_A, `pool_participants?pool_id=eq.${pool.id}&select=quotas`)).reduce(
    (sum, p) => sum + p.quotas,
    0,
  );
  check("apenas uma inclusão simultânea vence a última cota", accepted === 1, `aceitas=${accepted}`);
  check("cotas comprometidas não passam do total", quotas <= pool.total_quotas, `${quotas}/${pool.total_quotas}`);

  if (TOKEN_B) {
    check(
      "B não lê o bolão de A",
      (await read(TOKEN_B, `pools?id=eq.${pool.id}&select=id`)).length === 0,
    );
    check("B não altera participante de A", (await patch({ name: "invadido" }, TOKEN_B)).status !== 200);
    check(
      "B não usa a RPC no bolão de A",
      (await rpc(TOKEN_B, "pool_update_participant", { _participant_id: pid, _patch: { quotas: 9 } })).status >=
        400,
    );
  } else {
    console.log("AVISO: PROBE_TOKEN_B não definido — testes de segundo usuário ignorados.");
  }
} finally {
  const parts = await read(TOKEN_A, `pool_participants?pool_id=eq.${pool.id}&select=id`);
  for (const p of parts) await call(TOKEN_A, `pool_payments?participant_id=eq.${p.id}`, { method: "DELETE" });
  await call(TOKEN_A, `pool_participants?pool_id=eq.${pool.id}`, { method: "DELETE" });
  await call(TOKEN_A, `pool_events?pool_id=eq.${pool.id}`, { method: "DELETE" });
  await call(TOKEN_A, `pools?id=eq.${pool.id}`, { method: "DELETE" });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
process.exit(failed.length === 0 ? 0 : 1);
