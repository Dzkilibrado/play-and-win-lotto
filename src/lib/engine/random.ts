/**
 * Abstração da fonte de aleatoriedade.
 * Produção usa crypto; testes usam fonte determinística com semente.
 */
export interface RandomSource {
  /** Inteiro sem sinal de 32 bits. */
  nextUint32(): number;
}

export const cryptoRandomSource: RandomSource = {
  nextUint32() {
    const globalCrypto = globalThis.crypto;
    if (globalCrypto?.getRandomValues) {
      const buffer = new Uint32Array(1);
      globalCrypto.getRandomValues(buffer);
      return buffer[0]!;
    }
    // Ambiente sem crypto: degrada, mas nunca quebra a geração.
    return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
  },
};

/** mulberry32 — determinístico, usado em testes. */
export function seededRandomSource(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    nextUint32() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) >>> 0;
    },
  };
}

/** Inteiro uniforme em [0, bound) sem viés de módulo. */
export function randomBelow(source: RandomSource, bound: number): number {
  if (bound <= 1) return 0;
  const limit = Math.floor(0x1_0000_0000 / bound) * bound;
  for (;;) {
    const value = source.nextUint32();
    if (value < limit) return value % bound;
  }
}

/** Inteiro uniforme em [0, bound) para espaços maiores que 2^32. */
export function randomBelowBig(source: RandomSource, bound: bigint): bigint {
  if (bound <= 1n) return 0n;
  const bits = bound.toString(2).length;
  const words = Math.ceil(bits / 32);
  for (;;) {
    let value = 0n;
    for (let i = 0; i < words; i += 1) {
      value = (value << 32n) | BigInt(source.nextUint32());
    }
    value >>= BigInt(words * 32 - bits);
    if (value < bound) return value;
  }
}

/** Fisher–Yates com a fonte injetada. */
export function shuffleInPlace<T>(items: T[], source: RandomSource): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomBelow(source, i + 1);
    const temp = items[i]!;
    items[i] = items[j]!;
    items[j] = temp;
  }
  return items;
}

/** Float uniforme em [0, 1) a partir da fonte injetada. */
export function randomUnit(source: RandomSource): number {
  return source.nextUint32() / 0x1_0000_0000;
}

/**
 * Amostragem ponderada SEM reposição.
 *
 * Algoritmo: roleta acumulada com remoção (swap-and-pop). A cada seleção o item
 * escolhido sai da distribuição e o total é recalculado, então nenhuma dezena
 * pode repetir dentro do mesmo jogo — não existe "corrigir duplicata depois".
 * Custo O(k * n), suficiente para universos de até 80 dezenas.
 *
 * Todos os pesos precisam ser positivos; qualquer valor inválido cai no piso.
 */
export function weightedSampleWithoutReplacement(
  pool: number[],
  weightOf: (value: number) => number,
  k: number,
  source: RandomSource,
  minWeight = 1e-6,
): number[] {
  const items = [...pool];
  const weights = items.map((value) => {
    const weight = weightOf(value);
    return Number.isFinite(weight) && weight > 0 ? weight : minWeight;
  });
  let remaining = items.length;
  let total = weights.reduce((sum, value) => sum + value, 0);
  const picked: number[] = [];
  const count = Math.min(k, remaining);

  for (let index = 0; index < count; index += 1) {
    let target = randomUnit(source) * total;
    let chosen = remaining - 1;
    for (let position = 0; position < remaining; position += 1) {
      target -= weights[position]!;
      if (target <= 0) {
        chosen = position;
        break;
      }
    }
    picked.push(items[chosen]!);
    total -= weights[chosen]!;
    remaining -= 1;
    items[chosen] = items[remaining]!;
    weights[chosen] = weights[remaining]!;
  }
  return picked;
}
