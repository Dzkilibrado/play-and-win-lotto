#!/usr/bin/env node
/**
 * Lint incremental — roda o ESLint apenas nos arquivos alterados em relação
 * a uma base, em vez da auditoria completa do repositório.
 *
 * Por quê: o projeto acumula uma dívida de lint preexistente grande (ver
 * "bun run lint"), então usar a auditoria completa como gate de CI deixaria
 * o pipeline permanentemente vermelho. Este script é o gate real: ERROS
 * PREEXISTENTES não bloqueiam; REGRESSÕES NOVAS em arquivos tocados neste
 * PR/push bloqueiam.
 *
 * Base de diff, em ordem de prioridade:
 *   1. LINT_CHANGED_BASE (setado pelo workflow: SHA base do PR, ou "before"
 *      do push);
 *   2. HEAD~1 (push direto com histórico disponível);
 *   3. árvore vazia via `git show HEAD` (primeiro commit / histórico raso).
 *
 * Nenhum "|| true", nenhuma máscara de erro: o código de saída do ESLint é
 * propagado sem alteração quando há arquivos a verificar.
 */
import { execFileSync } from "node:child_process";

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

function listChangedFiles(base) {
  const args = base
    ? ["diff", "--name-status", "--diff-filter=ACMR", `${base}...HEAD`]
    : ["show", "--name-status", "--diff-filter=ACMR", "--pretty=format:", "HEAD"];

  const output = execFileSync("git", args, { encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\t").pop())
    .filter((file) => LINTABLE_EXTENSIONS.some((ext) => file.endsWith(ext)));
}

function main() {
  const base = resolveBase();
  const changedFiles = listChangedFiles(base);

  if (changedFiles.length === 0) {
    console.log("[lint-changed] Nenhum arquivo lintável alterado. Nada a verificar.");
    return;
  }

  console.log(`[lint-changed] Verificando ${changedFiles.length} arquivo(s) alterado(s):`);
  changedFiles.forEach((file) => console.log(`  - ${file}`));

  try {
    execFileSync("node_modules/.bin/eslint", changedFiles, { stdio: "inherit" });
  } catch (error) {
    // Propaga o código de saída real do ESLint — sem máscara, sem fallback.
    process.exit(error.status ?? 1);
  }
}

main();
