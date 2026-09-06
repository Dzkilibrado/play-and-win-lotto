/**
 * Funções matemáticas centrais do motor.
 * Primos, Fibonacci e combinações vivem SÓ aqui.
 */

/** C(n, k) exato com BigInt (sem enumerar combinações). */
export function combinationsBig(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k)) return 0n;
  if (k < 0 || n < 0 || k > n) return 0n;
  const kk = BigInt(Math.min(k, n - k));
  let result = 1n;
  const bn = BigInt(n);
  for (let i = 1n; i <= kk; i += 1n) {
    result = (result * (bn - kk + i)) / i;
  }
  return result;
}

/** C(n, k) como número (pode virar Infinity em espaços gigantes). */
export function combinations(n: number, k: number): number {
  const value = combinationsBig(n, k);
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : Number.POSITIVE_INFINITY;
}

/** Primalidade genérica (não uma lista fixa de 1..80). */
export function isPrime(value: number): boolean {
  if (!Number.isInteger(value) || value < 2) return false;
  if (value % 2 === 0) return value === 2;
  for (let divisor = 3; divisor * divisor <= value; divisor += 2) {
    if (value % divisor === 0) return false;
  }
  return true;
}

/**
 * Sequência de Fibonacci positiva usada em todo o sistema: 1, 2, 3, 5, 8, 13…
 * O 1 conta uma única vez (não duplicado).
 */
export function fibonacciSet(max: number): Set<number> {
  const set = new Set<number>();
  let previous = 1;
  let current = 2;
  if (max >= 1) set.add(1);
  while (current <= max) {
    set.add(current);
    const next = previous + current;
    previous = current;
    current = next;
  }
  return set;
}

export function isFibonacci(value: number, max = value): boolean {
  return fibonacciSet(Math.max(max, value)).has(value);
}
