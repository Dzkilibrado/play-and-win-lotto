/** Hash e gerador pseudoaleatório determinísticos (sem dependências, síncronos). */

function xmur3(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** Identificador estável de 128 bits (32 hexadecimais) para um texto. */
export function hashText(text: string): string {
  const next = xmur3(text);
  return [next(), next(), next(), next()].map((n) => n.toString(16).padStart(8, "0")).join("");
}

/** sfc32: gerador de números em [0, 1) a partir de uma semente em texto. */
export function createRng(seed: string): () => number {
  const next = xmur3(seed);
  let a = next();
  let b = next();
  let c = next();
  let d = next();
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
