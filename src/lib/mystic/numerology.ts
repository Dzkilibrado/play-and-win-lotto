/**
 * Numerologia pitagórica (regras tradicionais, documentadas em docs/MEU_DESTINO.md).
 * Funções puras e determinísticas.
 *
 * Convenções fixadas:
 *  - acentos são ignorados (ã = a);
 *  - 11, 22 e 33 (números mestres) não são reduzidos;
 *  - vogais são A, E, I, O, U; todas as demais letras, inclusive Y, são consoantes.
 */

const LETTER_VALUES: Record<string, number> = {};
for (const [value, letters] of [
  [1, "AJS"],
  [2, "BKT"],
  [3, "CLU"],
  [4, "DMV"],
  [5, "ENW"],
  [6, "FOX"],
  [7, "GPY"],
  [8, "HQZ"],
  [9, "IR"],
] as const) {
  for (const letter of letters) LETTER_VALUES[letter] = value;
}

const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const MASTER_NUMBERS = new Set([11, 22, 33]);

/** Letras A–Z sem acento, em maiúsculas. Qualquer outro caractere é descartado. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/** Reduz até 1 dígito, preservando 11, 22 e 33. */
export function reduceNumber(value: number): number {
  let current = Math.abs(Math.trunc(value));
  while (current > 9 && !MASTER_NUMBERS.has(current)) {
    current = String(current)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return current;
}

/** Reduz sempre até 1 dígito (usado onde mestres não se aplicam, como raiz digital). */
export function digitalRoot(value: number): number {
  let current = Math.abs(Math.trunc(value));
  while (current > 9) {
    current = String(current)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return current;
}

function sumLetters(letters: string[]): number {
  return letters.reduce((sum, letter) => sum + (LETTER_VALUES[letter] ?? 0), 0);
}

export function expressionNumber(fullName: string): number {
  return reduceNumber(sumLetters([...normalizeName(fullName)]));
}

export function soulNumber(fullName: string): number {
  return reduceNumber(sumLetters([...normalizeName(fullName)].filter((l) => VOWELS.has(l))));
}

export function personalityNumber(fullName: string): number {
  return reduceNumber(sumLetters([...normalizeName(fullName)].filter((l) => !VOWELS.has(l))));
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** Caminho de vida: reduz dia, mês e ano separadamente e soma os resultados. */
export function lifePathNumber({ year, month, day }: DateParts): number {
  return reduceNumber(reduceNumber(day) + reduceNumber(month) + reduceNumber(year));
}

export function birthDayNumber({ day }: DateParts): number {
  return reduceNumber(day);
}

/** Ano pessoal: dia e mês de nascimento somados ao ano corrente. */
export function personalYearNumber({ month, day }: DateParts, currentYear: number): number {
  return reduceNumber(reduceNumber(day) + reduceNumber(month) + reduceNumber(currentYear));
}

/** Vibração do grupo (bolão): número de pessoas reduzido. */
export function groupNumber(people: number): number {
  return reduceNumber(Math.max(1, Math.trunc(people)));
}
