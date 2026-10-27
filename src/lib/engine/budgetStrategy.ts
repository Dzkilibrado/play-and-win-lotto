/**
 * Motor de estratégia por orçamento.
 *
 * Dado um valor disponível e uma ou mais modalidades escolhidas, calcula
 * quantos jogos e quantas dezenas por jogo melhor aproveitam o orçamento,
 * conforme duas escolhas independentes do usuário:
 *
 * - `priority`: como montar cada jogo dentro de uma modalidade
 *     "max_games"       → prioriza quantidade de jogos (dezenas na base, mais barato)
 *     "max_probability"  → prioriza força por jogo (mais dezenas, menos jogos)
 *
 * - `profile`: como repartir o orçamento quando mais de uma modalidade é
 *   escolhida
 *     "cost_benefit" → favorece a modalidade com melhor relação
 *                      combinações/preço (mais cobertura por real)
 *     "max_prize"    → favorece a modalidade com maior potencial de prêmio,
 *                      seguindo a ordem canônica já definida em
 *                      `lotteryConfigs` (sortOrder), nunca um valor de
 *                      prêmio inventado
 *
 * Nenhum valor de prêmio é projetado ou estimado aqui — apenas preço oficial
 * (tabela `lottery_prices`) e combinatória. Sobra de orçamento que não fecha
 * com nenhuma configuração válida é reportada, nunca descartada em silêncio
 * nem "arredondada" para dentro.
 */

import { type LotterySlug, combinationCount, lotteryConfigs } from "@/config/lotteries";
import { generationConfig } from "@/config/generation.config";

export type BudgetStrategyPriority = "max_games" | "max_probability";
export type BudgetStrategyProfile = "cost_benefit" | "max_prize";

/** Uma linha da tabela oficial `lottery_prices` para uma modalidade. */
export interface BudgetPriceRow {
  numbersSelected: number;
  price: number;
  combinationCount: number;
}

export interface BudgetStrategyInput {
  /** Valor total disponível, em reais. */
  budget: number;
  /** Modalidades marcadas pelo usuário (ao menos uma). */
  modalities: LotterySlug[];
  priority: BudgetStrategyPriority;
  profile: BudgetStrategyProfile;
  /** Preços vigentes por modalidade, já carregados do banco (sem hardcode). */
  pricesBySlug: Record<string, BudgetPriceRow[]>;
}

export interface BudgetStrategyAllocation {
  slug: LotterySlug;
  name: string;
  /** Dezenas por jogo escolhidas para esta modalidade. */
  numbersSelected: number;
  /** Preço oficial vigente para essa quantidade de dezenas. */
  pricePerGame: number;
  /** Quantidade de jogos que cabem no valor alocado a esta modalidade. */
  gamesCount: number;
  /** Custo total desta modalidade (gamesCount * pricePerGame). */
  totalCost: number;
  /** Combinações cobertas por jogo, apenas informativo (não é prêmio). */
  combinationsPerGame: number;
  /** Parcela do orçamento reservada a esta modalidade antes do cálculo. */
  budgetAllocated: number;
  /** Sobra desta modalidade que não fechou em nenhum jogo adicional. */
  leftover: number;
  /** Verdadeiro quando nem um jogo mínimo coube no valor alocado. */
  unaffordable: boolean;
}

export interface BudgetStrategyResult {
  allocations: BudgetStrategyAllocation[];
  totalCost: number;
  totalLeftover: number;
  /** Modalidades que não receberam nenhum jogo por falta de orçamento. */
  excludedModalities: LotterySlug[];
  /** Avisos para exibição direta ao usuário (nunca dados técnicos). */
  warnings: string[];
}

/** Ordena modalidades conforme o perfil escolhido, sem inventar prêmios. */
function rankModalities(
  modalities: LotterySlug[],
  profile: BudgetStrategyProfile,
  pricesBySlug: Record<string, BudgetPriceRow[]>,
): LotterySlug[] {
  if (profile === "max_prize") {
    // Ordem canônica do produto (lotteryConfigs.sortOrder): Mega-Sena primeiro.
    return [...modalities].sort(
      (a, b) => lotteryConfigs[a].sortOrder - lotteryConfigs[b].sortOrder,
    );
  }

  // cost_benefit: melhor relação combinações/preço na aposta base de cada modalidade.
  const efficiency = (slug: LotterySlug): number => {
    const base = lotteryConfigs[slug].selectable.base;
    const row = pricesBySlug[slug]?.find((price) => price.numbersSelected === base);
    if (!row || row.price <= 0) return 0;
    return row.combinationCount / row.price;
  };
  return [...modalities].sort((a, b) => efficiency(b) - efficiency(a));
}

/** Escolhe dezenas e preço por jogo para uma modalidade dentro do valor alocado. */
function pickGameShape(
  slug: LotterySlug,
  priority: BudgetStrategyPriority,
  subBudget: number,
  prices: BudgetPriceRow[],
): { numbersSelected: number; pricePerGame: number; combinations: number } | null {
  const config = lotteryConfigs[slug];
  const sorted = [...prices].sort((a, b) => a.numbersSelected - b.numbersSelected);
  const affordable = sorted.filter(
    (row) =>
      row.numbersSelected >= config.selectable.min &&
      row.numbersSelected <= config.selectable.max &&
      row.price <= subBudget &&
      row.price > 0,
  );
  if (affordable.length === 0) return null;

  const chosen =
    priority === "max_games"
      ? // Mais barato possível (menor dezena) para maximizar quantidade de jogos.
        affordable[0]!
      : // Mais dezenas possível para maximizar força/cobertura por jogo.
        affordable[affordable.length - 1]!;

  return {
    numbersSelected: chosen.numbersSelected,
    pricePerGame: chosen.price,
    combinations: chosen.combinationCount,
  };
}

export function computeBudgetStrategy(input: BudgetStrategyInput): BudgetStrategyResult {
  const { budget, modalities, priority, profile, pricesBySlug } = input;

  if (budget <= 0 || modalities.length === 0) {
    return {
      allocations: [],
      totalCost: 0,
      totalLeftover: Math.max(budget, 0),
      excludedModalities: [...modalities],
      warnings:
        budget <= 0
          ? ["Informe um valor disponível maior que zero."]
          : ["Selecione ao menos uma modalidade."],
    };
  }

  const ranked = rankModalities(modalities, profile, pricesBySlug);
  const warnings: string[] = [];
  const allocations: BudgetStrategyAllocation[] = [];
  const excludedModalities: LotterySlug[] = [];

  // Reserva fatias iguais entre as modalidades; quem não consegue pagar nem
  // um jogo mínimo devolve a fatia ao restante, redistribuída pela ordem do
  // perfil escolhido — nunca descartada.
  let remainingBudget = budget;
  let pendingModalities = [...ranked];

  for (const slug of ranked) {
    if (!pendingModalities.includes(slug)) continue;

    const share = remainingBudget / pendingModalities.length;
    const prices = pricesBySlug[slug] ?? [];
    const shape = pickGameShape(slug, priority, share, prices);

    if (!shape) {
      // Não cabe nem um jogo mínimo nesta fatia: exclui e redistribui o resto.
      excludedModalities.push(slug);
      pendingModalities = pendingModalities.filter((item) => item !== slug);
      continue;
    }

    const maxAffordableGames = Math.floor(share / shape.pricePerGame);
    const gamesCount = Math.max(
      1,
      Math.min(maxAffordableGames, generationConfig.maxGamesPerRequest),
    );
    const totalCost = gamesCount * shape.pricePerGame;
    const leftover = Math.round((share - totalCost) * 100) / 100;

    allocations.push({
      slug,
      name: lotteryConfigs[slug].name,
      numbersSelected: shape.numbersSelected,
      pricePerGame: shape.pricePerGame,
      gamesCount,
      totalCost: Math.round(totalCost * 100) / 100,
      combinationsPerGame: shape.combinations,
      budgetAllocated: Math.round(share * 100) / 100,
      leftover,
      unaffordable: false,
    });

    remainingBudget -= share;
    pendingModalities = pendingModalities.filter((item) => item !== slug);
  }

  if (excludedModalities.length > 0) {
    const names = excludedModalities.map((slug) => lotteryConfigs[slug].name).join(", ");
    warnings.push(
      excludedModalities.length === 1
        ? `O valor disponível não é suficiente para incluir ${names} nesta divisão.`
        : `O valor disponível não é suficiente para incluir ${names} nesta divisão.`,
    );
  }

  const totalCost =
    Math.round(allocations.reduce((sum, item) => sum + item.totalCost, 0) * 100) / 100;
  const totalLeftover = Math.round((budget - totalCost) * 100) / 100;

  if (allocations.length === 0) {
    warnings.push("Nenhuma modalidade selecionada comporta um jogo com o valor informado.");
  } else if (totalLeftover > 0) {
    warnings.push(
      `Sobra de ${totalLeftover.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} que não fecha com um jogo adicional em nenhuma modalidade selecionada.`,
    );
  }

  return { allocations, totalCost, totalLeftover, excludedModalities, warnings };
}
