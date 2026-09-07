/**
 * Definição dos 9 filtros de geração.
 * Todo cálculo matemático vem de `../metrics` — nunca reimplementado aqui.
 */
import { fibonacciSet, isPrime } from "../math";
import {
  evenCount,
  gridDistribution,
  maxConsecutiveRun,
  maxEqualGapStreak,
  primeCount,
  repeatedCount,
  sumTotal,
} from "../metrics";
import type {
  FilterConfigMap,
  FilterContext,
  FilterId,
  FilterIssue,
  GameFilterDefinition,
  LineConfig,
  RangeConfig,
} from "./types";

function issue(filterId: FilterId, code: string, message: string): FilterIssue {
  return { filterId, code, message };
}

/** Faixa possível para uma contagem (ex.: pares, primos) dados fixos e excluídos. */
export function countFeasibility(
  context: FilterContext,
  predicate: (value: number) => boolean,
) {
  const fixedMatching = context.fixed.filter(predicate).length;
  const remaining = context.numbersCount - context.fixed.length;
  const poolMatching = context.pool.filter(predicate).length;
  const poolOther = context.pool.length - poolMatching;
  const min = fixedMatching + Math.max(0, remaining - poolOther);
  const max = fixedMatching + Math.min(remaining, poolMatching);
  return { fixedMatching, min, max, remaining };
}

/** Soma mínima e máxima alcançáveis com a configuração atual. */
export function sumFeasibility(context: FilterContext) {
  const fixedSum = sumTotal(context.fixed);
  const remaining = Math.max(0, context.numbersCount - context.fixed.length);
  const sorted = [...context.pool].sort((a, b) => a - b);
  const lowest = sorted.slice(0, remaining);
  const highest = sorted.slice(Math.max(0, sorted.length - remaining));
  return { min: fixedSum + sumTotal(lowest), max: fixedSum + sumTotal(highest) };
}

function rangeIssues(
  id: FilterId,
  config: RangeConfig,
  feasible: { min: number; max: number },
  labels: { subject: string; fixedSubject: string },
): FilterIssue[] {
  const issues: FilterIssue[] = [];
  const { min, max } = config;
  if (min != null && max != null && min > max) {
    issues.push(issue(id, "MIN_GT_MAX", `Em ${labels.subject}, o mínimo não pode ser maior que o máximo.`));
    return issues;
  }
  if (min != null && min > feasible.max) {
    issues.push(
      issue(
        id,
        "IMPOSSIBLE_MIN",
        `Não é possível gerar jogos com esta configuração: ${labels.subject} permite no máximo ${feasible.max}, mas o mínimo pedido é ${min}.`,
      ),
    );
  }
  if (max != null && max < feasible.min) {
    issues.push(
      issue(
        id,
        "IMPOSSIBLE_MAX",
        `Não é possível gerar jogos com esta configuração: ${labels.fixedSubject} já resulta em pelo menos ${feasible.min}, acima do máximo de ${max}.`,
      ),
    );
  }
  return issues;
}

function inRange(value: number, config: RangeConfig) {
  if (config.min != null && value < config.min) return false;
  if (config.max != null && value > config.max) return false;
  return true;
}

function rangeText(config: RangeConfig, unit: string) {
  const { min, max } = config;
  if (min != null && max != null) return min === max ? `${min} ${unit}` : `${min}–${max} ${unit}`;
  if (min != null) return `mín. ${min} ${unit}`;
  if (max != null) return `máx. ${max} ${unit}`;
  return unit;
}

const isEven = (value: number) => value % 2 === 0;

const parityFilter: GameFilterDefinition<"parity"> = {
  id: "parity",
  label: "Pares e ímpares",
  description: "Controla quantas dezenas pares cada jogo pode ter. Os ímpares são o restante.",
  defaultConfig: { min: null, max: null },
  isConfigured: (config) => config.min != null || config.max != null,
  validateConfiguration(config, context) {
    const feasible = countFeasibility(context, isEven);
    const issues = rangeIssues(this.id, config, feasible, {
      subject: "pares e ímpares",
      fixedSubject: "os números fixados",
    });
    if (config.max != null && feasible.fixedMatching > config.max) {
      return [
        issue(
          this.id,
          "FIXED_CONFLICT",
          `Os números fixados já ultrapassam o máximo de pares definido (${feasible.fixedMatching} pares fixados, máximo ${config.max}).`,
        ),
      ];
    }
    return issues;
  },
  evaluateCandidate: (numbers, config) => inRange(evenCount(numbers), config),
  explain(config, context) {
    const { min, max } = config;
    if (min != null && min === max) {
      return `${min} pares / ${context.numbersCount - min} ímpares`;
    }
    return rangeText(config, "pares");
  },
};

const sumFilter: GameFilterDefinition<"sum"> = {
  id: "sum",
  label: "Soma das dezenas",
  description: "Restringe a soma total das dezenas do jogo.",
  defaultConfig: { min: null, max: null },
  isConfigured: (config) => config.min != null || config.max != null,
  validateConfiguration(config, context) {
    const feasible = sumFeasibility(context);
    return rangeIssues(this.id, config, feasible, {
      subject: "soma das dezenas",
      fixedSubject: "a soma dos números fixados",
    });
  },
  evaluateCandidate: (numbers, config) => inRange(sumTotal(numbers), config),
  explain(config) {
    const { min, max } = config;
    if (min != null && max != null) return `Soma ${min}–${max}`;
    if (min != null) return `Soma a partir de ${min}`;
    if (max != null) return `Soma até ${max}`;
    return "Soma";
  },
};

/** Máximo de dezenas que cabem sem passar de `maxPerLine` por linha/coluna. */
function lineCapacity(lines: number, maxPerLine: number | null, sizes: number[]) {
  if (maxPerLine == null) return Number.POSITIVE_INFINITY;
  void lines;
  return sizes.reduce((total, size) => total + Math.min(size, maxPerLine), 0);
}

function makeLineFilter(
  id: "rows" | "columns",
  label: string,
  description: string,
  axis: "rows" | "columns",
): GameFilterDefinition<"rows" | "columns"> {
  const noun = axis === "rows" ? "linha" : "coluna";
  const plural = axis === "rows" ? "linhas" : "colunas";
  return {
    id,
    label,
    description,
    defaultConfig: { maxPerLine: null, minOccupied: null, maxOccupied: null },
    isConfigured: (config) =>
      config.maxPerLine != null || config.minOccupied != null || config.maxOccupied != null,
    validateConfiguration(config: LineConfig, context) {
      const issues: FilterIssue[] = [];
      const lines = axis === "rows" ? context.rules.grid.rows : context.rules.grid.columns;
      if (config.maxPerLine != null && config.maxPerLine < 1) {
        issues.push(issue(id, "INVALID_MAX", `O máximo por ${noun} precisa ser pelo menos 1.`));
      }
      if (
        config.minOccupied != null &&
        config.maxOccupied != null &&
        config.minOccupied > config.maxOccupied
      ) {
        issues.push(issue(id, "MIN_GT_MAX", `Em ${plural} ocupadas, o mínimo não pode ser maior que o máximo.`));
      }
      // Capacidade real considerando dezenas disponíveis em cada linha/coluna.
      const buckets = new Map<string, number>();
      for (const value of [...context.pool, ...context.fixed]) {
        const distribution = gridDistribution([value], context.rules);
        const key = Object.entries(axis === "rows" ? distribution.rows : distribution.columns).find(
          ([, count]) => count > 0,
        )?.[0];
        if (key) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      const capacity = lineCapacity(lines, config.maxPerLine, [...buckets.values()]);
      if (config.maxPerLine != null && capacity < context.numbersCount) {
        issues.push(
          issue(
            id,
            "IMPOSSIBLE_CAPACITY",
            `Não é possível gerar jogos com esta configuração: com no máximo ${config.maxPerLine} por ${noun}, cabem apenas ${capacity} dezenas.`,
          ),
        );
      }
      if (config.maxPerLine != null && context.fixed.length) {
        const fixedDistribution = gridDistribution(context.fixed, context.rules);
        const worst = axis === "rows" ? fixedDistribution.maxPerRow : fixedDistribution.maxPerColumn;
        if (worst > config.maxPerLine) {
          issues.push(
            issue(
              id,
              "FIXED_CONFLICT",
              `Os números fixados já colocam ${worst} dezenas em uma mesma ${noun}, acima do máximo de ${config.maxPerLine}.`,
            ),
          );
        }
      }
      if (config.maxOccupied != null) {
        const fixedDistribution = gridDistribution(context.fixed, context.rules);
        const occupied =
          axis === "rows" ? fixedDistribution.occupiedRows : fixedDistribution.occupiedColumns;
        if (occupied > config.maxOccupied) {
          issues.push(
            issue(
              id,
              "FIXED_CONFLICT",
              `Os números fixados já ocupam ${occupied} ${plural}, acima do máximo de ${config.maxOccupied}.`,
            ),
          );
        }
      }
      if (config.minOccupied != null && config.minOccupied > Math.min(lines, context.numbersCount)) {
        issues.push(
          issue(
            id,
            "IMPOSSIBLE_MIN",
            `Um jogo de ${context.numbersCount} dezenas ocupa no máximo ${Math.min(lines, context.numbersCount)} ${plural}.`,
          ),
        );
      }
      return issues;
    },
    evaluateCandidate(numbers, config: LineConfig, context) {
      const distribution = gridDistribution(numbers, context.rules);
      const worst = axis === "rows" ? distribution.maxPerRow : distribution.maxPerColumn;
      const occupied = axis === "rows" ? distribution.occupiedRows : distribution.occupiedColumns;
      if (config.maxPerLine != null && worst > config.maxPerLine) return false;
      if (config.minOccupied != null && occupied < config.minOccupied) return false;
      if (config.maxOccupied != null && occupied > config.maxOccupied) return false;
      return true;
    },
    explain(config: LineConfig) {
      const parts: string[] = [];
      if (config.maxPerLine != null) parts.push(`Máx. ${config.maxPerLine} por ${noun}`);
      if (config.minOccupied != null || config.maxOccupied != null) {
        parts.push(
          rangeText({ min: config.minOccupied, max: config.maxOccupied }, `${plural} ocupadas`),
        );
      }
      return parts.join(" · ") || label;
    },
  } as GameFilterDefinition<"rows" | "columns">;
}

const rowsFilter = makeLineFilter(
  "rows",
  "Dezenas por linha",
  "Limita quantas dezenas do jogo podem ficar na mesma linha do volante.",
  "rows",
) as GameFilterDefinition<"rows">;

const columnsFilter = makeLineFilter(
  "columns",
  "Dezenas por coluna",
  "Limita quantas dezenas do jogo podem ficar na mesma coluna do volante.",
  "columns",
) as GameFilterDefinition<"columns">;

const repeatedFilter: GameFilterDefinition<"repeated"> = {
  id: "repeated",
  label: "Repetidas do concurso anterior",
  description: "Controla quantas dezenas do jogo também saíram no concurso anterior.",
  defaultConfig: { min: null, max: null, reference: "previous-of-selected" },
  isConfigured: (config) => config.min != null || config.max != null,
  validateConfiguration(config, context) {
    if (!context.previousDraw) {
      return [
        issue(
          this.id,
          "NO_REFERENCE",
          "Não foi possível identificar o concurso anterior necessário para este filtro.",
        ),
      ];
    }
    const reference = new Set(context.previousDraw.numbers);
    const feasible = countFeasibility(context, (value) => reference.has(value));
    const issues = rangeIssues(this.id, config, feasible, {
      subject: "repetidas do concurso anterior",
      fixedSubject: "os números fixados",
    });
    if (config.max != null && feasible.fixedMatching > config.max) {
      return [
        issue(
          this.id,
          "FIXED_CONFLICT",
          `Os números fixados já repetem ${feasible.fixedMatching} dezenas do concurso anterior, acima do máximo de ${config.max}.`,
        ),
      ];
    }
    return issues;
  },
  evaluateCandidate(numbers, config, context) {
    if (!context.previousDraw) return false;
    return inRange(repeatedCount(numbers, context.previousDraw.numbers), config);
  },
  explain(config, context) {
    const base = rangeText(config, "repetidas");
    const contest = context.previousDraw?.contestNumber;
    return contest ? `${base} (concurso ${contest})` : base;
  },
};

const consecutiveFilter: GameFilterDefinition<"consecutive"> = {
  id: "consecutive",
  label: "Números consecutivos",
  description: "Limita quantas dezenas em sequência podem aparecer no mesmo jogo.",
  defaultConfig: { max: null },
  isConfigured: (config) => config.max != null,
  validateConfiguration(config, context) {
    const issues: FilterIssue[] = [];
    const max = config.max;
    if (max == null) return issues;
    if (max < 1) {
      issues.push(issue(this.id, "INVALID_MAX", "O máximo de dezenas consecutivas precisa ser pelo menos 1."));
      return issues;
    }
    if (maxConsecutiveRun(context.fixed) > max) {
      issues.push(
        issue(
          this.id,
          "FIXED_CONFLICT",
          `Os números fixados já formam ${maxConsecutiveRun(context.fixed)} dezenas em sequência, acima do máximo de ${max}.`,
        ),
      );
      return issues;
    }
    // Capacidade real: só as dezenas DISPONÍVEIS (pool + fixas) entram na conta.
    // Cada bloco de inteiros consecutivos disponíveis comporta, no máximo,
    // `max` dezenas a cada `max + 1` posições.
    const available = [...new Set([...context.pool, ...context.fixed])].sort((a, b) => a - b);
    const block = max + 1;
    let capacity = 0;
    let runLength = 0;
    const closeRun = () => {
      capacity += Math.floor(runLength / block) * max + Math.min(runLength % block, max);
      runLength = 0;
    };
    for (let index = 0; index < available.length; index += 1) {
      if (index > 0 && available[index]! - available[index - 1]! !== 1) closeRun();
      runLength += 1;
    }
    closeRun();
    if (capacity < context.numbersCount) {
      issues.push(
        issue(
          this.id,
          "IMPOSSIBLE_CAPACITY",
          `Não é possível gerar jogos com esta configuração: com no máximo ${max} dezenas em sequência, cabem apenas ${capacity} dezenas entre as disponíveis.`,
        ),
      );
    }
    return issues;
  },
  evaluateCandidate: (numbers, config) =>
    config.max == null || maxConsecutiveRun(numbers) <= config.max,
  explain: (config) => `Máx. ${config.max} consecutivos`,
};

const gapRunFilter: GameFilterDefinition<"gapRun"> = {
  id: "gapRun",
  label: "Saltos entre dezenas",
  description:
    "Limita quantas vezes o mesmo intervalo pode se repetir em sequência. Ex.: 05 → 10 → 15 → 20 repete o intervalo +5 três vezes.",
  defaultConfig: { max: null },
  isConfigured: (config) => config.max != null,
  validateConfiguration(config, context) {
    const issues: FilterIssue[] = [];
    const max = config.max;
    if (max == null) return issues;
    if (max < 1) {
      issues.push(
        issue(this.id, "INVALID_MAX", "O máximo de saltos iguais seguidos precisa ser pelo menos 1."),
      );
      return issues;
    }
    // Só é conflito comprovado quando nenhuma dezena adicional pode quebrar a
    // sequência — ou seja, quando o jogo já é formado apenas pelas fixas.
    const fixedStreak = maxEqualGapStreak(context.fixed);
    if (context.fixed.length === context.numbersCount && fixedStreak > max) {
      issues.push(
        issue(
          this.id,
          "FIXED_CONFLICT",
          `Os números fixados já formam ${fixedStreak} saltos iguais seguidos, acima do máximo de ${max}.`,
        ),
      );
    }
    return issues;
  },
  evaluateCandidate: (numbers, config) =>
    config.max == null || maxEqualGapStreak(numbers) <= config.max,
  explain: (config) =>
    `Máx. ${config.max} ${config.max === 1 ? "salto igual seguido" : "saltos iguais seguidos"}`,
};


const fibonacciFilter: GameFilterDefinition<"fibonacci"> = {
  id: "fibonacci",
  label: "Números de Fibonacci",
  description: "Controla quantas dezenas da sequência de Fibonacci (1, 2, 3, 5, 8, 13…) o jogo tem.",
  defaultConfig: { min: null, max: null },
  isConfigured: (config) => config.min != null || config.max != null,
  validateConfiguration(config, context) {
    const fibs = fibonacciSet(context.rules.universe.max);
    const feasible = countFeasibility(context, (value) => fibs.has(value));
    const issues = rangeIssues(this.id, config, feasible, {
      subject: "números de Fibonacci",
      fixedSubject: "os números fixados",
    });
    if (config.max != null && feasible.fixedMatching > config.max) {
      return [
        issue(
          this.id,
          "FIXED_CONFLICT",
          `Os números fixados já incluem ${feasible.fixedMatching} dezenas de Fibonacci, acima do máximo de ${config.max}.`,
        ),
      ];
    }
    return issues;
  },
  evaluateCandidate(numbers, config, context) {
    const fibs = fibonacciSet(context.rules.universe.max);
    return inRange(numbers.filter((value) => fibs.has(value)).length, config);
  },
  explain: (config) => rangeText(config, "Fibonacci"),
};

const primeFilter: GameFilterDefinition<"prime"> = {
  id: "prime",
  label: "Números primos",
  description: "Controla quantas dezenas primas o jogo pode ter. O número 1 não é primo.",
  defaultConfig: { min: null, max: null },
  isConfigured: (config) => config.min != null || config.max != null,
  validateConfiguration(config, context) {
    const feasible = countFeasibility(context, isPrime);
    const issues = rangeIssues(this.id, config, feasible, {
      subject: "números primos",
      fixedSubject: "os números fixados",
    });
    if (config.max != null && feasible.fixedMatching > config.max) {
      return [
        issue(
          this.id,
          "FIXED_CONFLICT",
          `Os números fixados já incluem ${feasible.fixedMatching} primos, acima do máximo de ${config.max}.`,
        ),
      ];
    }
    return issues;
  },
  evaluateCandidate: (numbers, config) => inRange(primeCount(numbers), config),
  explain: (config) => rangeText(config, "primos"),
};

export const filterDefinitions: { [K in FilterId]: GameFilterDefinition<K> } = {
  parity: parityFilter,
  sum: sumFilter,
  rows: rowsFilter,
  columns: columnsFilter,
  repeated: repeatedFilter,
  consecutive: consecutiveFilter,
  gapRun: gapRunFilter,
  fibonacci: fibonacciFilter,
  prime: primeFilter,
};

export type { FilterConfigMap };
