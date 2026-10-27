/**
 * Chaves canônicas da seleção secundária.
 *
 * O jogo e o resultado oficial só se comparam por estas chaves, então a fonte
 * (sincronização), o catálogo e a tela precisam produzir exatamente a mesma
 * forma: mês = "01".."12"; clube = nome sem acento, em maiúsculas, com espaços
 * normalizados ("FLAMENGO/RJ").
 */
import { monthOptions } from "@/config/lotteries";

function strip(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "Março" / "MARÇO" / "marco" → "03"; desconhecido → null. */
export function monthKeyFromName(name: string): string | null {
  const wanted = strip(name).trim().toLowerCase();
  const found = monthOptions.find((option) => strip(option.label).toLowerCase() === wanted);
  return found ? found.value : null;
}

/** Chave canônica de um clube: sem acento, maiúsculas, espaços normalizados. */
export function clubKey(name: string): string {
  return strip(name)
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim()
    .toUpperCase();
}

/** Nome legível de uma escolha; sem opção cadastrada, mostra a própria chave. */
export function secondaryLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

export interface ParsedClub {
  value: string;
  label: string;
}

/**
 * Lê a lista de clubes colada pela administração, um por linha:
 * "Flamengo/RJ", "Flamengo - RJ" ou "Flamengo (RJ)". Tudo vira "Nome/UF".
 * Linhas vazias são ignoradas; repetidas (mesma chave) entram uma vez só.
 */
export function parseClubLines(text: string): { clubs: ParsedClub[]; invalid: string[] } {
  const clubs: ParsedClub[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:\d+\s*[.)\-–]\s*)?/, "").trim();
    if (!line) continue;
    const match = /^(.+?)\s*(?:\/|\s-\s|\s–\s|\()\s*([A-Za-z]{2})\)?\s*$/.exec(line);
    if (!match) {
      invalid.push(raw.trim());
      continue;
    }
    const label = `${match[1]!.trim()}/${match[2]!.toUpperCase()}`;
    const value = clubKey(label);
    if (seen.has(value)) continue;
    seen.add(value);
    clubs.push({ value, label });
  }
  return { clubs, invalid };
}
