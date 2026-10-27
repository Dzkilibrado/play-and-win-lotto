/**
 * Perfil místico: a partir dos dados informados calcula as "marcas" (números
 * e signos) que orientam a geração. Nada aqui é exibido ao usuário.
 */
import {
  ascendantLongitude,
  moonLongitude,
  moonPhaseIndex,
  rulerNumber,
  signFromLongitude,
  sunLongitude,
} from "./astrology";
import { localToUtc } from "./birthTime";
import { hashText } from "./hash";
import {
  birthDayNumber,
  expressionNumber,
  groupNumber,
  lifePathNumber,
  normalizeName,
  personalityNumber,
  personalYearNumber,
  soulNumber,
} from "./numerology";

export const intentions = ["SORTE", "AMOR", "DINHEIRO", "SAUDE", "TRABALHO"] as const;
export type Intention = (typeof intentions)[number];
export const intentionLabel: Record<Intention, string> = {
  SORTE: "Sorte geral",
  AMOR: "Amor",
  DINHEIRO: "Dinheiro",
  SAUDE: "Saúde",
  TRABALHO: "Trabalho",
};
/** Número tradicional associado a cada intenção (convenção do sistema). */
const intentionNumber: Record<Intention, number> = {
  SORTE: 3,
  AMOR: 6,
  DINHEIRO: 8,
  SAUDE: 4,
  TRABALHO: 1,
};

export const traditions = ["NUMEROLOGIA", "ASTROLOGIA", "COMBINADA"] as const;
export type Tradition = (typeof traditions)[number];
export const traditionLabel: Record<Tradition, string> = {
  NUMEROLOGIA: "Numerologia",
  ASTROLOGIA: "Astrologia",
  COMBINADA: "Numerologia e astrologia",
};

export interface BirthPlace {
  latitude: number;
  longitude: number;
  timeZone: string;
}

export interface MysticInput {
  fullName: string;
  /** AAAA-MM-DD */
  birthDate: string;
  /** HH:MM, opcional */
  birthTime?: string | null;
  birthPlace?: BirthPlace | null;
  intention: Intention;
  tradition: Tradition;
  /** Total de pessoas do bolão, quando for bolão. */
  groupSize?: number | null;
}

/** Valor com peso: quanto mais alto, mais o número ligado a ele é favorecido. */
export interface Mark {
  value: number;
  weight: number;
  /** Mês (1–12) associado, quando fizer sentido. */
  month?: number;
}

export interface MysticProfile {
  /** Texto canônico dos dados que definem o destino (sem a loteria). */
  key: string;
  marks: Mark[];
  /** Mês de nascimento, usado no Mês da Sorte. */
  birthMonth: number;
  element: string;
  /** Há ascendente (hora e local informados)? */
  hasAscendant: boolean;
}

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

/** Texto canônico: dados iguais geram sempre o mesmo texto. */
export function canonicalKey(input: MysticInput): string {
  const place = input.birthPlace
    ? `${input.birthPlace.latitude.toFixed(2)},${input.birthPlace.longitude.toFixed(2)}`
    : "";
  const time = input.birthPlace && input.birthTime ? input.birthTime : "";
  return [
    normalizeName(input.fullName),
    input.birthDate,
    time,
    place,
    input.intention,
    input.tradition,
    String(input.groupSize && input.groupSize > 1 ? Math.trunc(input.groupSize) : 0),
  ].join("|");
}

/** Semente do destino: mesma pessoa, mesma loteria, mesmos números — sempre. */
export function destinySeed(input: MysticInput, lotterySlug: string): string {
  return hashText(`destino|${canonicalKey(input)}|${lotterySlug}`);
}

/** Identificador da leitura para detectar repetição; preso ao usuário para não ser comparável entre contas. */
export function readingFingerprint(
  input: MysticInput,
  lotterySlug: string,
  userId: string,
): string {
  return hashText(`leitura|${userId}|${canonicalKey(input)}|${lotterySlug}`);
}

export function buildProfile(input: MysticInput, currentYear: number): MysticProfile {
  const date = parseDate(input.birthDate);
  const useNumerology = input.tradition !== "ASTROLOGIA";
  const useAstrology = input.tradition !== "NUMEROLOGIA";
  const marks: Mark[] = [];
  const push = (value: number, weight: number, month?: number) => {
    if (value >= 1) marks.push(month ? { value, weight, month } : { value, weight });
  };

  push(intentionNumber[input.intention], 1.5);

  if (useNumerology) {
    push(expressionNumber(input.fullName), 2);
    push(lifePathNumber(date), 2);
    push(soulNumber(input.fullName), 1.5);
    push(personalityNumber(input.fullName), 1.2);
    push(birthDayNumber(date), 1.2);
    push(personalYearNumber(date, currentYear), 1);
    if (input.groupSize && input.groupSize > 1) push(groupNumber(input.groupSize), 1.5);
  }

  let element = "";
  let hasAscendant = false;
  if (useAstrology) {
    const hasTime = Boolean(input.birthPlace && input.birthTime);
    // Sem hora, o meio-dia local representa o dia (Sol e Lua mudam pouco em horas).
    const zone = input.birthPlace?.timeZone ?? "America/Sao_Paulo";
    const instant = localToUtc(input.birthDate, hasTime ? input.birthTime! : "12:00", zone);
    const sun = signFromLongitude(sunLongitude(instant));
    const moon = signFromLongitude(moonLongitude(instant));
    element = sun.element;
    push(sun.index, 2, sun.index);
    push(rulerNumber[sun.ruler] ?? 0, 1.2);
    push(moon.index, 1.5, moon.index);
    push(moonPhaseIndex(instant) + 1, 1);
    if (hasTime && input.birthPlace) {
      const asc = signFromLongitude(
        ascendantLongitude(instant, input.birthPlace.latitude, input.birthPlace.longitude),
      );
      push(asc.index, 1.8, asc.index);
      hasAscendant = true;
    }
  }

  return {
    key: canonicalKey(input),
    marks,
    birthMonth: date.month,
    element,
    hasAscendant,
  };
}
