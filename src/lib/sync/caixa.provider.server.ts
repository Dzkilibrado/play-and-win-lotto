/**
 * Adapter da fonte oficial (CAIXA).
 * Único ponto do sistema que fala com a rede externa. Devolve sempre um
 * objeto normalizado e já validado, ou lança um SyncError classificado.
 */
import { getLotteryConfig, type JointTierDef, type LotterySlug } from "@/config/lotteries";
import { providerPath, syncConfig } from "@/config/sync.config";
import { clubKey, monthKeyFromName } from "@/lib/secondaryKeys";

export type SyncErrorType =
  "TIMEOUT" | "UNAVAILABLE" | "NOT_FOUND" | "INVALID_RESPONSE" | "VALIDATION" | "PERSISTENCE";

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
  /** 2º sorteio do concurso (Dupla Sena); `null` nas modalidades de sorteio único. */
  secondDraw: { numbers: number[]; prizes: NormalizedPrize[] } | null;
  /** Mês da Sorte / Time do Coração sorteado e sua faixa; `null` nas demais. */
  secondary: {
    result: string[];
    prize: { tier: string; winners: number | null; prizePerWinner: number | null } | null;
  } | null;
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

/** Texto sem acento/caixa, para comparar descrições de faixa. */
function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Marca de 2º sorteio na descrição da faixa ("... - 2º Sorteio", "segundo sorteio"). */
const SECOND_DRAW_MARK = /\b(?:2\s*[ºo°]?|segundo)\s*sorteio\b/;

function isSecondDrawDescription(description: string): boolean {
  return SECOND_DRAW_MARK.test(plain(description));
}

/**
 * Extrai o número de acertos da descrição da faixa. null = não interpretável.
 * `tierLabels` (faixas da modalidade) permite entender descrições por nome
 * ("Sena", "Terno") quando a fonte não traz o número de acertos.
 */
function parseHits(
  description: string,
  faixa: unknown,
  tierLabels: { hits: number; label: string }[] = [],
): number | null {
  // Lotomania tem uma faixa de ZERO acertos ("nenhum acerto"/"0 acertos") —
  // só o dígito "0" não aparece sozinho de forma confiável na descrição,
  // então o texto precisa ser checado antes do regex genérico de dígitos.
  const normalized = plain(description);
  if (/\bnenhum\s+acerto/.test(normalized) || /\b0\s*acerto/.test(normalized)) return 0;

  // O "2" de "2º sorteio" não pode ser lido como número de acertos.
  const withoutDrawMark = description.replace(/(?:2\s*[ºo°]?|segundo)\s*sorteio/gi, " ");

  const explicit = /(\d+)\s*acerto/i.exec(withoutDrawMark);
  if (explicit) {
    const hits = Number.parseInt(explicit[1]!, 10);
    if (Number.isInteger(hits) && hits >= 0) return hits;
  }

  const wordOnly = plain(withoutDrawMark).replace(/[^a-z]/g, "");
  if (wordOnly) {
    const byLabel = tierLabels.find((tier) => {
      const label = plain(tier.label).replace(/[^a-z]/g, "");
      return label.length > 0 && label === wordOnly;
    });
    if (byLabel) return byLabel.hits;
  }

  const match = /(\d+)/.exec(withoutDrawMark);
  if (match) {
    const hits = Number.parseInt(match[1]!, 10);
    if (Number.isInteger(hits) && hits >= 0) return hits;
  }
  void faixa;
  return null;
}

/**
 * Faixa conjunta ("5 acertos + 2 trevos", "4 acertos + 1 ou nenhum trevo"):
 * devolve a chave da faixa configurada ou null se a descrição não casa
 * exatamente com nenhuma — nunca se aproxima.
 */
function parseJointKey(description: string, defs: JointTierDef[]): number | null {
  const match =
    /(\d+)\s*acertos?\s*\+\s*(2\s*trevos?|1\s*ou\s*nenhum\s*trevo|1\s*trevo|nenhum\s*trevo|0\s*trevo)/.exec(
      plain(description),
    );
  if (!match) return null;
  const numberHits = Number.parseInt(match[1]!, 10);
  const phrase = match[2]!;
  const cloverHits = phrase.startsWith("2")
    ? [2]
    : /ou\s*nenhum/.test(phrase)
      ? [0, 1]
      : phrase.startsWith("1")
        ? [1]
        : [0];
  const def = defs.find(
    (item) =>
      item.numberHits === numberHits &&
      item.cloverHits.length === cloverHits.length &&
      item.cloverHits.every((value) => cloverHits.includes(value)),
  );
  return def ? def.key : null;
}

/** Faixa própria do Mês da Sorte / Time do Coração dentro do rateio oficial. */
const SECONDARY_PRIZE_MARK = /\b(?:mes\s+(?:de|da)\s+sorte|time\s+(?:do|de)\s+coracao)\b/;

function isSecondaryPrizeDescription(description: string): boolean {
  return SECONDARY_PRIZE_MARK.test(plain(description));
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
      throw new SyncError(
        "INVALID_RESPONSE",
        "Resposta da fonte não é JSON válido.",
        text.slice(0, 160),
      );
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

  const expectsSecondary = !!config.secondary;
  if (expectsSecondary && !draw.secondary) {
    throw new SyncError(
      "VALIDATION",
      `${config.secondary?.label}: resultado ausente na resposta oficial.`,
    );
  }

  if (!Number.isInteger(draw.contestNumber) || draw.contestNumber <= 0) {
    throw new SyncError("VALIDATION", "Número de concurso inválido.");
  }
  validateDrawSet(config, "", draw.numbers, draw.prizes);

  if (config.drawsPerContest > 1) {
    // Concurso de 2 sorteios só é aceito completo: um resultado parcial seria
    // conferido e pago como se fosse o final.
    if (!draw.secondDraw) {
      throw new SyncError("VALIDATION", "2º sorteio ausente na resposta oficial.");
    }
    validateDrawSet(config, "2º sorteio: ", draw.secondDraw.numbers, draw.secondDraw.prizes);
  }
}

function validateDrawSet(
  config: NonNullable<ReturnType<typeof getLotteryConfig>>,
  prefix: string,
  numbers: number[],
  prizes: NormalizedPrize[],
): void {
  // Quantas dezenas o SORTEIO revela — normalmente igual à aposta simples,
  // mas a Lotomania sorteia 20 de um universo de 100 com aposta de 50.
  const expected = config.drawnCount;
  if (numbers.length !== expected) {
    throw new SyncError(
      "VALIDATION",
      `${prefix}Esperadas ${expected} dezenas, recebidas ${numbers.length}.`,
    );
  }
  if (new Set(numbers).size !== numbers.length) {
    throw new SyncError("VALIDATION", `${prefix}Dezenas duplicadas na resposta oficial.`);
  }
  for (const number of numbers) {
    if (!Number.isInteger(number) || number < config.universe.min || number > config.universe.max) {
      throw new SyncError(
        "VALIDATION",
        `${prefix}Dezena ${number} fora do universo ${config.universe.min}–${config.universe.max}.`,
      );
    }
  }
  const allowedHits = new Set(config.prizeTiers.map((tier) => tier.hits));
  for (const prize of prizes) {
    if (!allowedHits.has(prize.hits)) {
      throw new SyncError(
        "VALIDATION",
        `${prefix}Faixa de premiação inesperada: ${prize.hits} acertos.`,
      );
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
      const draw = normalize(payload, slug);
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

function toNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[])
    .map((item) => Number.parseInt(String(item), 10))
    .filter((item) => Number.isFinite(item));
}

function normalizePrizes(
  items: Record<string, unknown>[],
  tierLabels: { hits: number; label: string }[],
  jointTiers?: JointTierDef[],
): NormalizedPrize[] {
  const prizes: NormalizedPrize[] = items.map((item, index) => {
    const description = cleanText(item["descricaoFaixa"]) ?? "";
    const hits = jointTiers
      ? parseJointKey(description, jointTiers)
      : parseHits(description, item["faixa"], tierLabels);
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
  return prizes;
}

function normalize(payload: Record<string, unknown>, slug: LotterySlug): NormalizedDraw {
  const contestNumber = toNumberOrNull(payload["numero"]);
  if (contestNumber === null) {
    throw new SyncError("INVALID_RESPONSE", "Resposta sem número de concurso.");
  }

  const config = getLotteryConfig(slug);
  const isMultiDraw = (config?.drawsPerContest ?? 1) > 1;
  const tierLabels = config?.prizeTiers ?? [];

  const ordered = Array.isArray(payload["dezenasSorteadasOrdemSorteio"])
    ? (payload["dezenasSorteadasOrdemSorteio"] as unknown[])
    : [];
  const ascending = Array.isArray(payload["listaDezenas"])
    ? (payload["listaDezenas"] as unknown[])
    : [];
  // Em modalidade de 2 sorteios, `dezenasSorteadasOrdemSorteio` pode misturar
  // os dois: o 1º sorteio vem sempre de `listaDezenas`.
  const rawNumbers = isMultiDraw ? ascending : ordered.length > 0 ? ordered : ascending;
  const numbers = toNumberList(rawNumbers);

  const allRateio = Array.isArray(payload["listaRateioPremio"])
    ? (payload["listaRateioPremio"] as Record<string, unknown>[])
    : [];

  // Mês da Sorte / Time do Coração: faixa própria, fora das faixas de dezenas
  // (senão a descrição "Time do Coração" seria rejeitada como faixa ilegível).
  const secondaryConfig =
    config?.secondary && config.secondary.kind !== "trevo" ? config.secondary : null;
  const rateio = secondaryConfig
    ? allRateio.filter(
        (item) => !isSecondaryPrizeDescription(cleanText(item["descricaoFaixa"]) ?? ""),
      )
    : allRateio;
  let secondary: NormalizedDraw["secondary"] = null;
  if (secondaryConfig) {
    const secondaryItems = allRateio.filter((item) =>
      isSecondaryPrizeDescription(cleanText(item["descricaoFaixa"]) ?? ""),
    );
    if (secondaryItems.length > 1) {
      throw new SyncError("VALIDATION", `${secondaryConfig.label}: faixa duplicada na resposta.`);
    }
    const drawnName = cleanText(payload["nomeTimeCoracaoMesSorte"]);
    const key = drawnName
      ? secondaryConfig.kind === "mes"
        ? monthKeyFromName(drawnName)
        : clubKey(drawnName)
      : null;
    if (!key) {
      throw new SyncError(
        "VALIDATION",
        `${secondaryConfig.label}: resultado ausente ou não reconhecido (${drawnName ?? "vazio"}).`,
        JSON.stringify(payload["nomeTimeCoracaoMesSorte"] ?? null).slice(0, 120),
      );
    }
    const item = secondaryItems[0];
    secondary = {
      result: [key],
      prize: item
        ? {
            tier: cleanText(item["descricaoFaixa"]) ?? secondaryConfig.prizeLabel,
            winners: toNumberLoose(item["numeroDeGanhadores"]),
            prizePerWinner: toNumberLoose(item["valorPremio"]),
          }
        : null,
    };
  }

  let prizes: NormalizedPrize[];
  let secondDraw: NormalizedDraw["secondDraw"] = null;
  if (isMultiDraw) {
    // Cada faixa precisa se declarar do 2º sorteio ("... 2º sorteio"); o que
    // não declara é do 1º. Se a fonte não separar, as faixas se repetem e a
    // verificação de duplicidade rejeita — nunca se mistura sorteio em silêncio.
    const firstItems = rateio.filter(
      (item) => !isSecondDrawDescription(cleanText(item["descricaoFaixa"]) ?? ""),
    );
    const secondItems = rateio.filter((item) =>
      isSecondDrawDescription(cleanText(item["descricaoFaixa"]) ?? ""),
    );
    prizes = normalizePrizes(firstItems, tierLabels);
    secondDraw = {
      numbers: toNumberList(payload["listaDezenasSegundoSorteio"]),
      prizes: normalizePrizes(secondItems, tierLabels),
    };
  } else {
    prizes = normalizePrizes(rateio, tierLabels, config?.jointTiers);
  }

  // +Milionária: os 2 trevos sorteados (sem faixa própria — entram nas conjuntas).
  if (config?.secondary?.kind === "trevo") {
    const clovers = Array.isArray(payload["trevosSorteados"])
      ? (payload["trevosSorteados"] as unknown[]).map((item) => Number.parseInt(String(item), 10))
      : [];
    const { min, max } = config.secondary.universe;
    const valid =
      clovers.length === config.secondary.selectable.base &&
      new Set(clovers).size === clovers.length &&
      clovers.every((value) => Number.isInteger(value) && value >= min && value <= max);
    if (!valid) {
      throw new SyncError(
        "VALIDATION",
        `${config.secondary.label}: trevos sorteados ausentes ou inválidos na resposta oficial.`,
        JSON.stringify(payload["trevosSorteados"] ?? null).slice(0, 120),
      );
    }
    secondary = { result: clovers.map(String).sort(), prize: null };
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
    secondDraw,
    secondary,
    isLatest: payload["ultimoConcurso"] === true,
    raw: { source: syncConfig.provider },
  };
}
