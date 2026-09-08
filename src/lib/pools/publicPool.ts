/**
 * Contrato da consulta pública do bolão (`pool_public_summary`).
 *
 * O que chega aqui é exatamente o que o link público pode mostrar: nome e
 * cotas de quem já pagou, jogos efetivamente apostados e o resultado oficial.
 * Telefones, valores individuais, pagamentos, rateio, documentos e
 * identificadores internos nunca fazem parte da resposta.
 */
import type { GameStatus, PoolStatus } from "@/types/domain";

export interface PublicParticipant {
  /**
   * Identidade pública estável da linha, atribuída pelo banco na ordem oficial
   * da lista. Não é o identificador interno do participante e não permite
   * localizar o cadastro: serve só para manter a mesma linha estável durante
   * busca, filtro e nova renderização.
   */
  ordinal: number;
  name: string;
  quotas: number;
}

export interface PublicGame {
  ordinal: number;
  numbers: number[];
  status: GameStatus;
  hits: number | null;
  isPrized: boolean | null;
  prizeLabel: string | null;
  prizeAmount: number | null;
}

export interface PublicResult {
  contestNumber: number;
  drawDate: string | null;
  drawnNumbers: number[];
  checkedGames: number;
  prizedGames: number;
  totalPrize: number | null;
}

export interface PublicPoolSummary {
  name: string;
  lottery: string;
  lotterySlug: string;
  contestNumber: number | null;
  drawDate: string | null;
  drawDatePlanned: boolean;
  status: PoolStatus;
  totalQuotas: number | null;
  assignedQuotas: number;
  paidQuotas: number;
  confirmedParticipants: number;
  availableQuotas: number | null;
  games: number;
  participants: PublicParticipant[];
  gameList: PublicGame[];
  result: PublicResult | null;
}

/**
 * Jogos que representam aposta efetiva e podem ser exibidos publicamente.
 * "Planejado" fica de fora: é rascunho interno do organizador.
 */
export const publicGameStatuses: GameStatus[] = [
  "BET",
  "RECEIPTED",
  "AWAITING_DRAW",
  "AWAITING_CHECK",
  "CHECKED",
  "PRIZED",
  "NOT_PRIZED",
];

export function isPubliclyVisibleGame(status: GameStatus): boolean {
  return publicGameStatuses.includes(status);
}

/** Nome estável do jogo dentro do bolão (nunca deriva de identificador). */
export function publicGameName(ordinal: number): string {
  return `Jogo ${String(ordinal).padStart(2, "0")}`;
}

/** Quantas pessoas/jogos mostrar antes do botão "Ver todos". */
export const publicPreviewSize = { participants: 12, games: 6 } as const;

/** Busca simples por nome, sem diferenciar acentos ou maiúsculas. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterParticipants(
  participants: PublicParticipant[],
  query: string,
): PublicParticipant[] {
  const term = normalizeName(query);
  if (!term) return participants;
  return participants.filter((participant) => normalizeName(participant.name).includes(term));
}

export function quotaText(quotas: number): string {
  return quotas === 1 ? "1 cota" : `${quotas} cotas`;
}

/** Forma usada no link público: "1 COTA" / "3 COTAS". */
export function quotaTextUpper(quotas: number): string {
  return quotas === 1 ? "1 COTA" : `${quotas} COTAS`;
}
