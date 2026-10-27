/**
 * Motor de estratégia por orçamento.
 *
 * Dado um valor disponível e uma ou mais modalidades escolhidas, calcula
 * como aproveitar ao máximo o valor dentro de cada modalidade, conforme
 * duas escolhas independentes do usuário:
 *
 * - `priority`: como montar os jogos dentro de uma modalidade
 *     "max_games"       → prioriza quantidade de jogos: usa sempre a
 *                         configuração mais barata (dezenas na base).
 *                         Misturar configurações não aumentaria a
 *                         quantidade de jogos (a mais barata já maximiza
 *                         isso), então nunca há mistura aqui.
 *     "max_probability" → prioriza força por jogo: preenche o valor de
 *                         forma GULOSA, começando pela maior quantidade
 *                         de dezenas afordável, comprando quantos jogos
 *                         couberem, e repetindo com a próxima
 *                         configuração mais forte enquanto sobrar valor
 *                         suficiente para pelo menos mais um jogo — ex.:
 *                         X jogos de 10 dezenas + X de 7 + X de 6, em vez
 *                         de parar no primeiro jogo e deixar o resto sem
 *                         uso.
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
 * com nenhum jogo adicional em nenhuma configuração disponível, em NENHUMA
 * modalidade selecionada, é reportada, nunca descartada em silêncio nem
 * "arredondada" para dentro.
 *
 * A divisão em fatias iguais por modalidade (abaixo) pode deixar, em cada
 * modalidade isoladamente, uma sobra pequena demais para mais um jogo ali —
 * mesmo quando a SOMA dessas sobras já daria para outro jogo, numa modalidade
 * qualquer. Por isso, depois da divisão inicial, uma etapa de "varredura"
 * (`mopUpLeftover`) junta toda sobra não comprometida e continua comprando o
 * jogo mais barato/forte que couber, em qualquer modalidade selecionada —
 * inclusive uma que tenha ficado de fora da divisão inicial —, até que o
 * valor restante realmente não feche com nenhum jogo em lugar nenhum.
 */

import { type LotterySlug, lotteryConfigs } from "@/config/lotteries";
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

/** Um grupo de jogos com a mesma quantidade de dezenas dentro de uma modalidade. */
export interface BudgetGameLine {
  /** Dezenas por jogo deste grupo. */
  numbersSelected: number;
  /** Preço oficial vigente para essa quantidade de dezenas. */
  pricePerGame: number;
  /** Quantidade de jogos deste grupo. */
  gamesCount: number;
  /** Combinações cobertas por jogo, apenas informativo (não é prêmio). */
  combinationsPerGame: number;
  /** Custo total deste grupo (gamesCount * pricePerGame). */
  subtotal: number;
}

export interface BudgetStrategyAllocation {
  slug: LotterySlug;
  name: string;
  /**
   * Um ou mais grupos de jogos (misturando dezenas diferentes quando a
   * prioridade é "mais força por jogo" e sobra valor após o primeiro
   * grupo). Em "mais jogos", sempre terá um único grupo.
   */
  lines: BudgetGameLine[];
  /** Soma de gamesCount de todos os grupos. */
  totalGamesCount: number;
  /** Custo total desta modalidade (soma dos subtotais dos grupos). */
  totalCost: number;
  /** Parcela do orçamento reservada a esta modalidade antes do cálculo. */
  budgetAllocated: number;
  /** Sobra desta modalidade que não fechou em nenhum jogo adicional, em nenhuma configuração disponível. */
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

/**
 * Preenche o valor alocado a uma modalidade com um ou mais grupos de jogos,
 * de forma gulosa, respeitando a prioridade escolhida.
 *
 * "max_games": ordena da configuração mais barata para a mais cara. Como a
 * mais barata maximiza por si só a quantidade de jogos, só é usada ela —
 * misturar não aumentaria a contagem.
 *
 * "max_probability": ordena da maior quantidade de dezenas para a menor.
 * Compra o máximo de jogos na configuração mais forte, e repete com a
 * próxima mais forte enquanto sobrar valor suficiente para mais um jogo em
 * alguma configuração restante — preenchendo o orçamento ao máximo em vez
 * de parar no primeiro grupo.
 */
function fillBudget(
  priority: BudgetStrategyPriority,
  subBudget: number,
  prices: BudgetPriceRow[],
  selectable: { min: number; max: number },
  maxTotalGames: number,
): { lines: BudgetGameLine[]; totalCost: number } {
  const candidates = prices
    .filter(
      (row) =>
        row.numbersSelected >= selectable.min &&
        row.numbersSelected <= selectable.max &&
        row.price > 0,
    )
    .sort((a, b) =>
      priority === "max_games"
        ? a.numbersSelected - b.numbersSelected
        : b.numbersSelected - a.numbersSelected,
    );

  if (priority === "max_games") {
    // A primeira configuração afordável já é a mais barata: maximiza a
    // contagem por si só, então um único grupo é sempre o ótimo.
    const cheapest = candidates.find((row) => row.price <= subBudget);
    if (!cheapest) return { lines: [], totalCost: 0 };
    const gamesCount = Math.min(Math.floor(subBudget / cheapest.price), maxTotalGames);
    if (gamesCount <= 0) return { lines: [], totalCost: 0 };
    const subtotal = Math.round(gamesCount * cheapest.price * 100) / 100;
    return {
      lines: [
        {
          numbersSelected: cheapest.numbersSelected,
          pricePerGame: cheapest.price,
          gamesCount,
          combinationsPerGame: cheapest.combinationCount,
          subtotal,
        },
      ],
      totalCost: subtotal,
    };
  }

  // max_probability: preenchimento guloso, começando pela mais forte.
  const lines: BudgetGameLine[] = [];
  let remaining = subBudget;
  let totalGames = 0;

  for (const candidate of candidates) {
    if (totalGames >= maxTotalGames) break;
    if (candidate.price > remaining) continue; // não cabe nem um jogo desta configuração; tenta a próxima

    const affordable = Math.floor(remaining / candidate.price);
    const gamesCount = Math.min(affordable, maxTotalGames - totalGames);
    if (gamesCount <= 0) continue;

    const subtotal = Math.round(gamesCount * candidate.price * 100) / 100;
    lines.push({
      numbersSelected: candidate.numbersSelected,
      pricePerGame: candidate.price,
      gamesCount,
      combinationsPerGame: candidate.combinationCount,
      subtotal,
    });
    remaining = Math.round((remaining - subtotal) * 100) / 100;
    totalGames += gamesCount;
  }

  const totalCost = Math.round(lines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100;
  return { lines, totalCost };
}

/**
 * Varre a sobra consolidada de todas as modalidades (inclusive as que
 * ficaram de fora da divisão inicial) e continua comprando — um jogo por
 * vez, no preço mais baixo/dezenas mais forte conforme a prioridade — em
 * qualquer modalidade onde ainda couber, até não caber mais nenhum jogo em
 * lugar nenhum. Isso evita que a divisão em fatias iguais deixe sobras
 * pequenas "presas" em cada modalidade isoladamente quando a soma delas já
 * daria para mais um jogo.
 *
 * Modifica `allocations` e `excludedModalities` em memória (cria uma nova
 * alocação quando uma modalidade antes excluída passa a caber um jogo) e
 * devolve o valor que de fato não fechou com nenhuma configuração.
 */
function mopUpLeftover(
  pool: number,
  priority: BudgetStrategyPriority,
  modalities: LotterySlug[],
  pricesBySlug: Record<string, BudgetPriceRow[]>,
  allocations: BudgetStrategyAllocation[],
  excludedModalities: LotterySlug[],
): number {
  if (pool <= 0) return Math.max(pool, 0);

  const allocationBySlug = new Map(allocations.map((allocation) => [allocation.slug, allocation]));

  const candidates = modalities
    .flatMap((slug) => {
      const selectable = lotteryConfigs[slug].selectable;
      return (pricesBySlug[slug] ?? [])
        .filter(
          (row) =>
            row.numbersSelected >= selectable.min &&
            row.numbersSelected <= selectable.max &&
            row.price > 0,
        )
        .map((row) => ({ slug, row }));
    })
    .sort((a, b) =>
      priority === "max_games"
        ? a.row.price - b.row.price || a.row.numbersSelected - b.row.numbersSelected
        : b.row.numbersSelected - a.row.numbersSelected || a.row.price - b.row.price,
    );

  let remaining = pool;
  let boughtSomething = true;

  while (boughtSomething && remaining > 0) {
    boughtSomething = false;

    for (const { slug, row } of candidates) {
      if (row.price > remaining) continue;

      const existingAllocation = allocationBySlug.get(slug);
      if ((existingAllocation?.totalGamesCount ?? 0) >= generationConfig.maxGamesPerRequest)
        continue;

      let allocation = existingAllocation;
      if (!allocation) {
        allocation = {
          slug,
          name: lotteryConfigs[slug].name,
          lines: [],
          totalGamesCount: 0,
          totalCost: 0,
          budgetAllocated: 0,
          leftover: 0,
          unaffordable: false,
        };
        allocations.push(allocation);
        allocationBySlug.set(slug, allocation);
        const excludedIndex = excludedModalities.indexOf(slug);
        if (excludedIndex >= 0) excludedModalities.splice(excludedIndex, 1);
      }

      const existingLine = allocation.lines.find(
        (line) => line.numbersSelected === row.numbersSelected,
      );
      if (existingLine) {
        existingLine.gamesCount += 1;
        existingLine.subtotal = Math.round((existingLine.subtotal + row.price) * 100) / 100;
      } else {
        allocation.lines.push({
          numbersSelected: row.numbersSelected,
          pricePerGame: row.price,
          gamesCount: 1,
          combinationsPerGame: row.combinationCount,
          subtotal: row.price,
        });
      }

      allocation.totalGamesCount += 1;
      allocation.totalCost = Math.round((allocation.totalCost + row.price) * 100) / 100;
      allocation.budgetAllocated = Math.round((allocation.budgetAllocated + row.price) * 100) / 100;
      allocation.leftover = Math.max(0, Math.round((allocation.leftover - row.price) * 100) / 100);

      remaining = Math.round((remaining - row.price) * 100) / 100;
      boughtSomething = true;
      break; // reinicia a varredura do topo (mais barato/forte) com o novo valor restante
    }
  }

  // Mantém os grupos de cada modalidade ordenados da maior para a menor
  // quantidade de dezenas, para uma exibição consistente após a varredura.
  for (const allocation of allocations) {
    allocation.lines.sort((a, b) => b.numbersSelected - a.numbersSelected);
  }

  return Math.max(remaining, 0);
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
    const { lines, totalCost } = fillBudget(
      priority,
      share,
      prices,
      lotteryConfigs[slug].selectable,
      generationConfig.maxGamesPerRequest,
    );

    if (lines.length === 0) {
      // Não cabe nem um jogo mínimo nesta fatia: exclui e redistribui o resto.
      excludedModalities.push(slug);
      pendingModalities = pendingModalities.filter((item) => item !== slug);
      continue;
    }

    const leftover = Math.round((share - totalCost) * 100) / 100;

    allocations.push({
      slug,
      name: lotteryConfigs[slug].name,
      lines,
      totalGamesCount: lines.reduce((sum, line) => sum + line.gamesCount, 0),
      totalCost,
      budgetAllocated: Math.round(share * 100) / 100,
      leftover,
      unaffordable: false,
    });

    remainingBudget -= share;
    pendingModalities = pendingModalities.filter((item) => item !== slug);
  }

  // A divisão em fatias iguais acima pode deixar, em cada modalidade
  // isoladamente, uma sobra pequena demais para mais um jogo ali — mesmo
  // quando a soma dessas sobras já fecharia com um jogo em outra
  // modalidade (inclusive uma excluída da divisão inicial). A varredura
  // junta toda a sobra e continua comprando enquanto couber em qualquer
  // modalidade selecionada, antes de reportar o valor como não utilizável.
  const costBeforeMopUp =
    Math.round(allocations.reduce((sum, item) => sum + item.totalCost, 0) * 100) / 100;
  const leftoverBeforeMopUp = Math.round((budget - costBeforeMopUp) * 100) / 100;
  const totalLeftover = mopUpLeftover(
    leftoverBeforeMopUp,
    priority,
    modalities,
    pricesBySlug,
    allocations,
    excludedModalities,
  );

  // Reordena pela mesma ordem de prioridade do perfil, já que a varredura
  // pode ter reincluído modalidades antes excluídas ao final da lista.
  allocations.sort((a, b) => ranked.indexOf(a.slug) - ranked.indexOf(b.slug));

  const totalCost = Math.round((budget - totalLeftover) * 100) / 100;

  if (excludedModalities.length > 0) {
    const names = excludedModalities.map((slug) => lotteryConfigs[slug].name).join(", ");
    warnings.push(`O valor disponível não é suficiente para incluir ${names} nesta divisão.`);
  }

  if (allocations.length === 0) {
    warnings.push("Nenhuma modalidade selecionada comporta um jogo com o valor informado.");
  } else if (totalLeftover > 0) {
    warnings.push(
      `Sobra de ${totalLeftover.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} que não fecha com um jogo adicional em nenhuma configuração disponível.`,
    );
  }

  return { allocations, totalCost, totalLeftover, excludedModalities, warnings };
}
