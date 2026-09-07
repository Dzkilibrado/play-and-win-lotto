/**
 * Máquina de estados do jogo e vocabulário de origem.
 *
 * Nomenclatura técnica fica só aqui e no banco; a interface usa sempre os
 * rótulos em português definidos em `@/types/domain`.
 */
import type { GameStatus } from "@/types/domain";

export const gameStatusOrder: GameStatus[] = [
  "PLANNED",
  "BET",
  "RECEIPTED",
  "AWAITING_DRAW",
  "AWAITING_CHECK",
  "CHECKED",
  "PRIZED",
  "NOT_PRIZED",
];

/** Situações que o próprio usuário pode escolher manualmente. */
export const manualStatuses: GameStatus[] = [
  "PLANNED",
  "BET",
  "RECEIPTED",
  "AWAITING_DRAW",
  "AWAITING_CHECK",
];

/** Situações definidas apenas pela conferência automática (etapa futura). */
export const automaticStatuses: GameStatus[] = ["CHECKED", "PRIZED", "NOT_PRIZED"];

export const gameStatusMeaning: Record<GameStatus, string> = {
  PLANNED: "Jogo salvo no aplicativo, sem comprovação de aposta.",
  BET: "Você informou que realizou a aposta.",
  RECEIPTED: "Existe comprovante da aposta realizada.",
  AWAITING_DRAW: "Aposta vinculada a um concurso que ainda não foi sorteado.",
  AWAITING_CHECK: "O concurso já foi sorteado e o jogo ainda precisa ser conferido.",
  CHECKED: "Jogo comparado com o resultado oficial.",
  PRIZED: "A conferência identificou premiação.",
  NOT_PRIZED: "A conferência foi concluída sem premiação.",
};

export type ContestSituation = "drawn" | "pending" | "unknown";

/**
 * Orienta (sem bloquear) transições que não fazem sentido para a situação do
 * concurso vinculado ao jogo.
 */
export function statusWarning(status: GameStatus, situation: ContestSituation): string | null {
  if (situation === "drawn" && status === "AWAITING_DRAW") {
    return "Este concurso já foi sorteado. O jogo deve ser conferido.";
  }
  if (situation === "pending" && status === "AWAITING_CHECK") {
    return "Este concurso ainda não foi sorteado. Não é possível conferir agora.";
  }
  if (situation === "unknown" && (status === "AWAITING_DRAW" || status === "AWAITING_CHECK")) {
    return "Informe um concurso para este jogo antes de usar esta situação.";
  }
  return null;
}

/** Situação sugerida quando existe comprovante de aposta paga. */
export function statusForReceipt(situation: ContestSituation): GameStatus {
  if (situation === "pending") return "AWAITING_DRAW";
  if (situation === "drawn") return "AWAITING_CHECK";
  return "RECEIPTED";
}

export type GameOrigin = "GENERATED" | "MANUAL" | "PHOTO_TICKET" | "PHOTO_RECEIPT";

export const gameOriginLabel: Record<GameOrigin, string> = {
  GENERATED: "Criado no aplicativo",
  MANUAL: "Criado manualmente",
  PHOTO_TICKET: "Importado de canhoto",
  PHOTO_RECEIPT: "Importado de comprovante",
};

export function originLabel(source: string | null | undefined): string {
  if (!source) return "Criado no aplicativo";
  return gameOriginLabel[source as GameOrigin] ?? "Criado no aplicativo";
}

/** Nome amigável e estável: nunca deriva de identificador interno. */
export function gameDisplayName(sequenceNumber: number | null | undefined): string {
  if (!sequenceNumber || sequenceNumber < 1) return "Jogo";
  return `Jogo ${String(sequenceNumber).padStart(2, "0")}`;
}
