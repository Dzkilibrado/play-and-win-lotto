/**
 * Conversão de data/hora local de nascimento para UTC e busca de município.
 * O fuso histórico (horário de verão passado) vem do banco de fusos do próprio JavaScript.
 */

function offsetMinutes(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMillis));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - utcMillis) / 60_000;
}

/** Converte "AAAA-MM-DD" + "HH:MM" locais no fuso informado para o instante UTC correspondente. */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let guess = naive - offsetMinutes(naive, timeZone) * 60_000;
  // Segunda passada: cobre datas próximas a mudanças de horário de verão.
  guess = naive - offsetMinutes(guess, timeZone) * 60_000;
  return new Date(guess);
}

export interface Municipality {
  name: string;
  uf: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

interface Dataset {
  fusos: string[];
  municipios: [string, string, number, number, number][];
}

let cache: Municipality[] | null = null;

/** Carrega a lista de municípios sob demanda (arquivo grande, só nesta tela). */
export async function loadMunicipalities(): Promise<Municipality[]> {
  if (cache) return cache;
  const data = (await import("@/data/municipios.json")).default as unknown as Dataset;
  cache = data.municipios.map(([name, uf, latitude, longitude, zone]) => ({
    name,
    uf,
    latitude,
    longitude,
    timeZone: data.fusos[zone] ?? "America/Sao_Paulo",
  }));
  return cache;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Busca por nome (sem acento), com prioridade para quem começa com o texto. */
export function searchMunicipalities(
  list: readonly Municipality[],
  query: string,
  limit = 8,
): Municipality[] {
  const term = fold(query);
  if (term.length < 2) return [];
  const starts: Municipality[] = [];
  const contains: Municipality[] = [];
  for (const item of list) {
    const name = fold(item.name);
    if (name.startsWith(term)) starts.push(item);
    else if (name.includes(term)) contains.push(item);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
