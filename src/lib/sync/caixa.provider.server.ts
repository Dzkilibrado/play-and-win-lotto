/**
 * Adapter da fonte oficial (CAIXA).
 * Único ponto do sistema que fala com a rede externa. Devolve sempre um
 * objeto normalizado e já validado, ou lança um SyncError classificado.
 */
import { getLotteryConfig, type LotterySlug } from "@/config/lotteries";
import { providerPath, syncConfig } from "@/config/sync.config";

export type SyncErrorType =
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "NOT_FOUND"
  | "INVALID_RESPONSE"
  | "VALIDATION"
  | "PERSISTENCE";

export class SyncError extends Error {
  readonly type: SyncErrorType;
  readonly payloadSummary: string | null;

  constructor(type: SyncErrorType, message: string, payloadSummary?: string | null) {
    super(message);
    this.name = "SyncError";
    this.type = type;
    this.payloadSummary = payloadSummary ?? null;
  }
}

export interface NormalizedPrize {
  tier: string;
  hits: number;
  /** null = fonte não informou (diferente de 0 informado oficialmente). */
  winners: number | null;
  prizePerWinner: number | null;
}

export interface NormalizedDraw {
  contestNumber: number;
  drawDate: string | null;
  drawLocation: string | null;
  isAccumulated: boolean | null;
  mainPrize: number | null;
  estimatedNextPrize: number | null;
  nextContestNumber: number | null;
  nextDrawDate: string | null;
  revenue: number | null;
  /** Dezenas na ordem oficial de sorteio quando disponível. */
  numbers: number[];
  prizes: NormalizedPrize[];
  isLatest: boolean;
  raw: { source: string };
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/** Aceita número ou string numérica; ausência/valor inválido vira null (nunca 0). */
function toNumberLoose(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const text = value.trim().replace(/\./g, "").replace(",", ".");
    if (text === "") return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Extrai o número de acertos da descrição da faixa. null = não interpretável. */
function parseHits(description: string, faixa: unknown): number | null {
  const match = /(\d+)/.exec(description);
  if (match) {
    const hits = Number.parseInt(match[1]!, 10);
    if (Number.isInteger(hits) && hits > 0) return hits;
  }
  void faixa;
  return null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/\u0000/g, "").trim();
  return text.length > 0 ? text : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), syncConfig.timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "GestorDeLoterias/1.0" },
    });
    if (response.status === 404) {
      throw new SyncError("NOT_FOUND", `Concurso inexistente na fonte (${url}).`);
    }
    if (!response.ok) {
      throw new SyncError("UNAVAILABLE", `Fonte respondeu ${response.status}.`);
    }
    const text = await response.text();
    if (!text.trim()) {
      throw new SyncError("INVALID_RESPONSE", "Fonte devolveu resposta vazia.");
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new SyncError("INVALID_RESPONSE", "Resposta da fonte não é JSON válido.", text.slice(0, 160));
    }
  } catch (error) {
    if (error instanceof SyncError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SyncError("TIMEOUT", `Tempo limite de ${syncConfig.timeoutMs}ms excedido.`);
    }
    throw new SyncError("UNAVAILABLE", error instanceof Error ? error.message : "Falha de rede.");
  } finally {
    clearTimeout(timer);
  }
}

/** Validação por modalidade (item 4 da especificação). */
function validate(slug: LotterySlug, draw: NormalizedDraw): void {
  const config = getLotteryConfig(slug);
  if (!config) throw new SyncError("VALIDATION", `Modalidade desconhecida: ${slug}.`);

  if (!Number.isInteger(draw.contestNumber) || draw.contestNumber <= 0) {
    throw new SyncError("VALIDATION", "Número de concurso inválido.");
  }
  const expected = config.selectable.base;
  if (draw.numbers.length !== expected) {
    throw new SyncError(
      "VALIDATION",
      `Esperadas ${expected} dezenas, recebidas ${draw.numbers.length}.`,
    );
  }
  if (new Set(draw.numbers).size !== draw.numbers.length) {
    throw new SyncError("VALIDATION", "Dezenas duplicadas na resposta oficial.");
  }
  for (const number of draw.numbers) {
    if (!Number.isInteger(number) || number < config.universe.min || number > config.universe.max) {
      throw new SyncError(
        "VALIDATION",
        `Dezena ${number} fora do universo ${config.universe.min}–${config.universe.max}.`,
      );
    }
  }
  const allowedHits = new Set(config.prizeTiers.map((tier) => tier.hits));
  for (const prize of draw.prizes) {
    if (!allowedHits.has(prize.hits)) {
      throw new SyncError("VALIDATION", `Faixa de premiação inesperada: ${prize.hits} acertos.`);
    }
  }
}

/**
 * Busca e valida um concurso. `contestNumber` ausente = último concurso.
 * Repete a chamada em falhas transitórias (timeout/indisponibilidade).
 */
export async function fetchOfficialDraw(
  slug: LotterySlug,
  contestNumber?: number,
): Promise<NormalizedDraw> {
  const path = providerPath[slug];
  const url = contestNumber
    ? `${syncConfig.baseUrl}/${path}/${contestNumber}`
    : `${syncConfig.baseUrl}/${path}`;

  let lastError: SyncError | null = null;
  for (let attempt = 1; attempt <= syncConfig.maxAttempts; attempt += 1) {
    try {
      const payload = (await fetchJson(url)) as Record<string, unknown>;
      const draw = normalize(payload);
      validate(slug, draw);
      return draw;
    } catch (error) {
      lastError = error instanceof SyncError ? error : new SyncError("UNAVAILABLE", String(error));
      if (lastError.type === "NOT_FOUND" || lastError.type === "VALIDATION") throw lastError;
      if (attempt < syncConfig.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError ?? new SyncError("UNAVAILABLE", "Falha desconhecida ao consultar a fonte.");
}

function normalize(payload: Record<string, unknown>): NormalizedDraw {
  const contestNumber = toNumberOrNull(payload["numero"]);
  if (contestNumber === null) {
    throw new SyncError("INVALID_RESPONSE", "Resposta sem número de concurso.");
  }

  const ordered = Array.isArray(payload["dezenasSorteadasOrdemSorteio"])
    ? (payload["dezenasSorteadasOrdemSorteio"] as unknown[])
    : [];
  const ascending = Array.isArray(payload["listaDezenas"])
    ? (payload["listaDezenas"] as unknown[])
    : [];
  const rawNumbers = ordered.length > 0 ? ordered : ascending;
  const numbers = rawNumbers
    .map((item) => Number.parseInt(String(item), 10))
    .filter((item) => Number.isFinite(item));

  const rateio = Array.isArray(payload["listaRateioPremio"])
    ? (payload["listaRateioPremio"] as Record<string, unknown>[])
    : [];
  const prizes: NormalizedPrize[] = rateio.map((item, index) => {
    const description = cleanText(item["descricaoFaixa"]) ?? "";
    const hits = parseHits(description, item["faixa"]);
    if (hits === null) {
      // Faixa devolvida pela fonte e não interpretável: nunca descartar em silêncio.
      throw new SyncError(
        "VALIDATION",
        `Faixa de premiação não interpretável (posição ${index + 1}): "${description}".`,
        JSON.stringify(item).slice(0, 300),
      );
    }
    return {
      tier: description || `faixa ${String(item["faixa"] ?? index + 1)}`,
      hits,
      winners: toNumberLoose(item["numeroDeGanhadores"]),
      prizePerWinner: toNumberLoose(item["valorPremio"]),
    };
  });

  const seenHits = new Set<number>();
  for (const prize of prizes) {
    if (seenHits.has(prize.hits)) {
      throw new SyncError("VALIDATION", `Faixa de premiação duplicada: ${prize.hits} acertos.`);
    }
    seenHits.add(prize.hits);
  }

  const municipio = cleanText(payload["nomeMunicipioUFSorteio"]);
  const local = cleanText(payload["localSorteio"]);
  const drawLocation = local && municipio ? `${local} — ${municipio}` : (local ?? municipio);

  return {
    contestNumber,
    drawDate: toIsoDate(payload["dataApuracao"]),
    drawLocation,
    isAccumulated: typeof payload["acumulado"] === "boolean" ? payload["acumulado"] : null,
    mainPrize: toNumberOrNull(payload["valorTotalPremioFaixaUm"]),
    estimatedNextPrize: toNumberOrNull(payload["valorEstimadoProximoConcurso"]),
    nextContestNumber: toNumberOrNull(payload["numeroConcursoProximo"]),
    nextDrawDate: toIsoDate(payload["dataProximoConcurso"]),
    revenue: toNumberOrNull(payload["valorArrecadado"]),
    numbers,
    prizes,
    isLatest: payload["ultimoConcurso"] === true,
    raw: { source: syncConfig.provider },
  };
}
