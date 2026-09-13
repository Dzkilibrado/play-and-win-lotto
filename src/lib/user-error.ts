const SAFE_MESSAGES = [
  "acima do devido",
  "bolão",
  "participante",
  "cota",
  "jogo",
  "pagamento",
  "concurso",
  "loteria",
  "comprovante",
  "arquivo",
  "permissão",
  "senha",
];

const TECHNICAL_MARKERS = [
  "jwt",
  "storage",
  "rls",
  "sql",
  "postgres",
  "supabase",
  "stack",
  "path",
  "claim",
  "row-level",
  "violates",
  "relation",
  "column",
  "function",
];

export function userErrorMessage(error: unknown, fallback = "Não foi possível concluir esta ação. Tente novamente.") {
  const values: unknown[] = [];
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    values.push(record["message"], record["details"], record["hint"]);
  } else values.push(error);

  const message = values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
  if (!message) return fallback;
  const normalized = message.toLocaleLowerCase("pt-BR");
  if (TECHNICAL_MARKERS.some((marker) => normalized.includes(marker))) return fallback;
  return SAFE_MESSAGES.some((marker) => normalized.includes(marker)) ? message : fallback;
}