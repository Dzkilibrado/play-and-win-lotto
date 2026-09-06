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
