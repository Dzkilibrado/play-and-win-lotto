#!/usr/bin/env node
/**
 * Lint incremental — bloqueia REGRESSÕES NOVAS em arquivos alterados,
 * sem bloquear a dívida de lint preexistente (ver "bun run lint" para a
 * auditoria completa, que hoje tem milhares de problemas preexistentes e
 * não serve como gate de CI).
 *
 * Importante: o ESLint sempre linta o ARQUIVO INTEIRO, não só as linhas
 * alteradas. Por isso não basta rodar `eslint <arquivos-alterados>` — um
 * arquivo preexistente com dívida antiga falharia mesmo sem nenhuma linha
 * nova problemática. Em vez disso, para cada arquivo já existente na base:
 *
 *   1. Lint do conteúdo na BASE (antes da mudança), via stdin;
 *   2. Lint do conteúdo no HEAD (depois da mudança);
 *   3. Mensagens (ruleId + texto) presentes no HEAD mas não na BASE são
 *      REGRESSÃO NOVA → bloqueiam. Mensagens já existentes na BASE são
 *      dívida preexistente → não bloqueiam, mesmo que a linha exata tenha
 *      se deslocado.
 *
 * Para arquivo NOVO (não existia na base), não há "preexistente" possível:
 * qualquer erro bloqueia.
 *
 * Base de diff, em ordem de prioridade:
 *   1. LINT_CHANGED_BASE (setado pelo workflow: SHA base do PR, ou "before"
 *      do push);
 *   2. HEAD~1 (push direto com histórico disponível);
 *   3. nenhuma base (primeiro commit / histórico raso) — todo arquivo do
 *      commit é tratado como novo.
 *
 * Nenhum "|| true", nenhuma máscara de erro: termina com código de saída
 * 1 sempre que houver ao menos uma regressão nova em algum arquivo.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LINTABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function resolveBase() {
  const envBase = process.env.LINT_CHANGED_BASE;
  if (envBase && envBase.trim()) return envBase.trim();

  try {
    execFileSync("git", ["rev-parse", "--verify", "HEAD~1"], { stdio: "ignore" });
    return "HEAD~1";
  } catch {
    return null; // sem histórico anterior disponível
  }
}

/** Lista { path, status } dos arquivos lintáveis alterados. */
function listChangedFiles(base) {
  const args = base
    ? ["diff", "--name-status", "--diff-filter=ACMR", `${base}...HEAD`]
    : ["show", "--name-status", "--diff-filter=ACMR", "--pretty=format:", "HEAD"];

  const output = execFileSync("git", args, { encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const status = parts[0][0]; // A, M, C ou R100 etc. — só a letra importa
      const path = parts[parts.length - 1];
      return { status, path };
    })
    .filter((entry) => LINTABLE_EXTENSIONS.some((ext) => entry.path.endsWith(ext)));
}

/** Roda o ESLint sobre um conteúdo (via stdin) e devolve as mensagens (JSON). */
function lintContent(content, filePath) {
  try {
    const output = execFileSync(
      "node_modules/.bin/eslint",
      ["--stdin", "--stdin-filename", filePath, "--format", "json"],
      { input: content, encoding: "utf8" },
    );
    return JSON.parse(output)[0]?.messages ?? [];
  } catch (error) {
    // ESLint sai com código 1 quando há erros, mas ainda imprime o JSON em stdout.
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout)[0]?.messages ?? [];
      } catch {
        throw new Error(
          `[lint-changed] Não foi possível interpretar a saída do ESLint para ${filePath}.`,
        );
      }
    }
    throw error;
  }
}

function messageKey(message) {
  return `${message.severity}:${message.ruleId ?? "unknown"}:${message.message}`;
}

/** Mensagens em `head` que não têm correspondência (por multiset) em `base`. */
function diffNewMessages(baseMessages, headMessages) {
  const baseCounts = new Map();
  for (const message of baseMessages) {
    const key = messageKey(message);
    baseCounts.set(key, (baseCounts.get(key) ?? 0) + 1);
  }

  const newMessages = [];
  for (const message of headMessages) {
    const key = messageKey(message);
    const remaining = baseCounts.get(key) ?? 0;
    if (remaining > 0) {
      baseCounts.set(key, remaining - 1); // consumida: já existia na base
    } else {
      newMessages.push(message); // não existia na base: regressão nova
    }
  }
  return newMessages;
}

function getBaseContent(base, filePath) {
  try {
    return execFileSync("git", ["show", `${base}:${filePath}`], { encoding: "utf8" });
  } catch {
    return null; // arquivo não existia na base (ex.: renomeado, ou base indisponível)
  }
}

function main() {
  const base = resolveBase();
  const changedFiles = listChangedFiles(base);

  if (changedFiles.length === 0) {
    console.log("[lint-changed] Nenhum arquivo lintável alterado. Nada a verificar.");
    return;
  }

  console.log(`[lint-changed] Verificando ${changedFiles.length} arquivo(s) alterado(s):`);
  changedFiles.forEach(({ path, status }) => console.log(`  - [${status}] ${path}`));

  let hasNewErrors = false;

  for (const { path, status } of changedFiles) {
    const headContent = readFileSync(path, "utf8");
    const headMessages = lintContent(headContent, path);

    const isNewFile = status === "A" || !base;
    const baseContent = isNewFile ? null : getBaseContent(base, path);
    const baseMessages = baseContent !== null ? lintContent(baseContent, path) : [];

    const newMessages = isNewFile ? headMessages : diffNewMessages(baseMessages, headMessages);
    const newErrors = newMessages.filter((message) => message.severity === 2);

    if (newErrors.length > 0) {
      hasNewErrors = true;
      console.log(`\n${path} — ${newErrors.length} regressão(ões) nova(s):`);
      for (const message of newErrors) {
        console.log(`  ${message.line}:${message.column}  ${message.message}  [${message.ruleId}]`);
      }
    }
  }

  if (hasNewErrors) {
    console.log(
      "\n[lint-changed] Há regressões novas de lint em arquivo(s) alterado(s). Falhando.",
    );
    process.exit(1);
  }

  console.log(
    "\n[lint-changed] Nenhuma regressão nova. Dívida preexistente (se houver) não bloqueia.",
  );
}

main();
