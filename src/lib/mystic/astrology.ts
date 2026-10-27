/**
 * Astrologia tropical ocidental: signo solar, Lua e ascendente.
 * Posições vêm de cálculo astronômico local (biblioteca astronomy-engine),
 * sem internet. Funções puras e determinísticas.
 */
import * as Astronomy from "astronomy-engine";

export type Element = "Fogo" | "Terra" | "Ar" | "Água";
export type Modality = "Cardinal" | "Fixo" | "Mutável";

export interface ZodiacSign {
  /** 1 (Áries) a 12 (Peixes). */
  index: number;
  name: string;
  element: Element;
  modality: Modality;
  ruler: string;
}

export const zodiac: readonly ZodiacSign[] = [
  { index: 1, name: "Áries", element: "Fogo", modality: "Cardinal", ruler: "Marte" },
  { index: 2, name: "Touro", element: "Terra", modality: "Fixo", ruler: "Vênus" },
  { index: 3, name: "Gêmeos", element: "Ar", modality: "Mutável", ruler: "Mercúrio" },
  { index: 4, name: "Câncer", element: "Água", modality: "Cardinal", ruler: "Lua" },
  { index: 5, name: "Leão", element: "Fogo", modality: "Fixo", ruler: "Sol" },
  { index: 6, name: "Virgem", element: "Terra", modality: "Mutável", ruler: "Mercúrio" },
  { index: 7, name: "Libra", element: "Ar", modality: "Cardinal", ruler: "Vênus" },
  { index: 8, name: "Escorpião", element: "Água", modality: "Fixo", ruler: "Plutão" },
  { index: 9, name: "Sagitário", element: "Fogo", modality: "Mutável", ruler: "Júpiter" },
  { index: 10, name: "Capricórnio", element: "Terra", modality: "Cardinal", ruler: "Saturno" },
  { index: 11, name: "Aquário", element: "Ar", modality: "Fixo", ruler: "Urano" },
  { index: 12, name: "Peixes", element: "Água", modality: "Mutável", ruler: "Netuno" },
];

/** Número tradicional do planeta regente (1–9), usado como base de afinidade. */
export const rulerNumber: Record<string, number> = {
  Sol: 1,
  Lua: 2,
  Júpiter: 3,
  Urano: 4,
  Mercúrio: 5,
  Vênus: 6,
  Netuno: 7,
  Saturno: 8,
  Marte: 9,
  Plutão: 9,
};

const norm = (degrees: number) => ((degrees % 360) + 360) % 360;

export function signFromLongitude(longitude: number): ZodiacSign {
  return zodiac[Math.floor(norm(longitude) / 30)]!;
}

export function sunLongitude(date: Date): number {
  return norm(Astronomy.SunPosition(date).elon);
}

export function moonLongitude(date: Date): number {
  return norm(Astronomy.EclipticGeoMoon(date).lon);
}

export const moonPhaseNames = [
  "Lua nova",
  "Crescente",
  "Quarto crescente",
  "Gibosa crescente",
  "Lua cheia",
  "Gibosa minguante",
  "Quarto minguante",
  "Minguante",
] as const;

/** Fase da Lua (0–7) pela elongação Lua–Sol. */
export function moonPhaseIndex(date: Date): number {
  const angle = norm(Astronomy.MoonPhase(date));
  return Math.floor(((angle + 22.5) % 360) / 45);
}

function meanObliquityDegrees(date: Date): number {
  const t = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (36_525 * 86_400_000);
  return 23.439291 - 0.0130042 * t;
}

/** Ascendente (longitude eclíptica) para um instante e um local. Latitude e longitude em graus (Leste positivo). */
export function ascendantLongitude(date: Date, latitude: number, longitude: number): number {
  const ramc = norm(Astronomy.SiderealTime(date) * 15 + longitude) * (Math.PI / 180);
  const epsilon = meanObliquityDegrees(date) * (Math.PI / 180);
  const phi = latitude * (Math.PI / 180);
  const y = Math.cos(ramc);
  const x = -(Math.sin(ramc) * Math.cos(epsilon) + Math.tan(phi) * Math.sin(epsilon));
  return norm(Math.atan2(y, x) * (180 / Math.PI));
}
