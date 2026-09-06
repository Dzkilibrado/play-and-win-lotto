/**
 * Request Validator: toda configuração é validada ANTES de qualquer loop.
 */
import { generationConfig } from "@/config/generation.config";
import { combinations } from "./math";
import { resolveRules } from "./rules";
import type { GenerationRequest, ValidationIssue, ValidationResult } from "./types";

export function validateGenerationRequest(request: GenerationRequest): ValidationResult {
  const issues: ValidationIssue[] = [];
  const rules = resolveRules(request.lotterySlug);

  if (!rules) {
    return {
      ok: false,
      issues: [{ code: "INVALID_LOTTERY", message: "Modalidade inválida ou indisponível." }],
      possibilities: 0,
      rules: null,
    };
  }

  const { numbersCount, gamesCount } = request;
  const fixed = [...request.fixed];
  const excluded = [...request.excluded];

  if (
    !Number.isInteger(numbersCount) ||
    numbersCount < rules.selectable.min ||
    numbersCount > rules.selectable.max
  ) {
    issues.push({
      code: "INVALID_NUMBERS_COUNT",
      message: `${rules.name} aceita de ${rules.selectable.min} a ${rules.selectable.max} dezenas por jogo.`,
    });
  }

  if (!Number.isInteger(gamesCount) || gamesCount < 1) {
    issues.push({
      code: "INVALID_GAMES_COUNT",
      message: "Informe pelo menos 1 jogo para gerar.",
    });
  } else if (gamesCount > generationConfig.maxGamesPerRequest) {
    issues.push({
      code: "GAMES_LIMIT",
      message: `O limite por geração é de ${generationConfig.maxGamesPerRequest} jogos.`,
    });
  }

  const inUniverse = (value: number) =>
    Number.isInteger(value) && value >= rules.universe.min && value <= rules.universe.max;

  const outOfUniverse = [...fixed, ...excluded].filter((value) => !inUniverse(value));
  if (outOfUniverse.length) {
    issues.push({
      code: "OUT_OF_UNIVERSE",
      message: `Fora do universo da ${rules.name} (${rules.universe.min} a ${rules.universe.max}): ${outOfUniverse.join(", ")}.`,
    });
  }

  if (new Set(fixed).size !== fixed.length || new Set(excluded).size !== excluded.length) {
    issues.push({
      code: "DUPLICATED_NUMBER",
      message: "Existe dezena repetida na lista de fixos ou de excluídos.",
    });
  }

  const overlap = fixed.filter((value) => excluded.includes(value));
  if (overlap.length) {
    issues.push({
      code: "FIXED_EXCLUDED_OVERLAP",
      message: `A mesma dezena não pode ser fixa e excluída: ${overlap.join(", ")}.`,
    });
  }

  const uniqueFixed = new Set(fixed.filter(inUniverse));
  const uniqueExcluded = new Set(excluded.filter((value) => inUniverse(value) && !uniqueFixed.has(value)));

  if (Number.isInteger(numbersCount) && uniqueFixed.size > numbersCount) {
    issues.push({
      code: "TOO_MANY_FIXED",
      message: `Você selecionou ${uniqueFixed.size} números fixos, mas este jogo possui apenas ${numbersCount} dezenas.`,
    });
  }

  const universeSize = rules.universe.max - rules.universe.min + 1;
  const available = universeSize - uniqueFixed.size - uniqueExcluded.size;
  const missing = numbersCount - uniqueFixed.size;

  if (issues.length === 0 && available < missing) {
    issues.push({
      code: "NOT_ENOUGH_AVAILABLE",
      message: "Não existem dezenas disponíveis suficientes para completar o jogo.",
    });
  }

  const possibilities = issues.length === 0 ? combinations(available, missing) : 0;

  if (issues.length === 0 && gamesCount > possibilities) {
    issues.push({
      code: "NOT_ENOUGH_COMBINATIONS",
      message:
        possibilities === 1
          ? "Com os números fixados e excluídos atualmente, existe apenas 1 jogo diferente possível."
          : `Com os números fixados e excluídos atualmente, existem apenas ${possibilities} jogos diferentes possíveis.`,
    });
  }

  return { ok: issues.length === 0, issues, possibilities, rules };
}
