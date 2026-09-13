import { syncConfig } from "@/config/sync.config";

export type AutomationStatus =
  | "UP_TO_DATE"
  | "WAITING_DRAW"
  | "WAITING_PUBLICATION"
  | "SYNCING"
  | "ATTENTION";

export type AutomationAction =
  | "HEALTH_CHECK"
  | "PRE_DRAW_CHECK"
  | "WAIT_PUBLICATION"
  | "RETRY"
  | "CONSISTENCY_CHECK";

export function expectedDrawAt(drawDate: string | null): string | null {
  if (!drawDate) return null;
  // Desde julho/2026, os sorteios de domingo acontecem às 11h; nos demais
  // dias de concurso, às 21h. A data da fonte é interpretada em São Paulo.
  const weekday = new Date(`${drawDate}T12:00:00-03:00`).getUTCDay();
  const hour = weekday === 0 ? syncConfig.sundayDrawHour : syncConfig.officialDrawHour;
  return `${drawDate}T${String(hour).padStart(2, "0")}:00:00-03:00`;
}

export function retryDelayMinutes(
  consecutiveFailures: number,
  now?: Date,
  expectedAt?: string | null,
): number {
  if (now && expectedAt) {
    const elapsed = now.getTime() - Date.parse(expectedAt);
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < syncConfig.postDrawFastWindowMinutes * 60_000) {
      return syncConfig.postDrawIntervalMinutes;
    }
  }
  const index = Math.min(
    Math.max(consecutiveFailures, 0),
    syncConfig.retryBackoffMinutes.length - 1,
  );
  return syncConfig.retryBackoffMinutes[index] ?? syncConfig.maxRetryDelayMinutes;
}

export function nextRetryAt(
  now: Date,
  consecutiveFailures: number,
  expectedAt?: string | null,
): string {
  return new Date(
    now.getTime() + retryDelayMinutes(consecutiveFailures, now, expectedAt) * 60_000,
  ).toISOString();
}

export function waitingStatus(errorType: string, nextFailureCount: number): AutomationStatus {
  if (errorType === "VALIDATION" || errorType === "INVALID_RESPONSE") return "ATTENTION";
  return nextFailureCount >= syncConfig.attentionAfterAttempts
    ? "ATTENTION"
    : "WAITING_PUBLICATION";
}

export function isBeforeExpectedDraw(now: Date, expectedAt: string | null): boolean {
  if (!expectedAt) return false;
  const timestamp = Date.parse(expectedAt);
  return Number.isFinite(timestamp) && now.getTime() < timestamp;
}

function zonedDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Próxima consulta útil antes do sorteio: saúde ou confirmação prévia. */
export function nextPreDrawAction(
  now: Date,
  expectedAt: string | null,
): { action: AutomationAction; at: string } {
  const candidates: { action: AutomationAction; at: Date }[] = [];
  const today = zonedDateParts(now);
  for (const hour of syncConfig.healthCheckHours) {
    const at = new Date(`${today}T${String(hour).padStart(2, "0")}:00:00-03:00`);
    if (at.getTime() > now.getTime()) candidates.push({ action: "HEALTH_CHECK", at });
  }
  if (expectedAt) {
    const drawTime = Date.parse(expectedAt);
    if (Number.isFinite(drawTime)) {
      const preDraw = new Date(drawTime - syncConfig.preDrawWindowMinutes * 60_000);
      if (preDraw.getTime() > now.getTime()) {
        candidates.push({ action: "PRE_DRAW_CHECK", at: preDraw });
      }
      if (drawTime > now.getTime()) {
        candidates.push({ action: "WAIT_PUBLICATION", at: new Date(drawTime) });
      }
    }
  }
  candidates.sort((left, right) => left.at.getTime() - right.at.getTime());
  const first = candidates[0];
  if (first) return { action: first.action, at: first.at.toISOString() };

  const tomorrow = new Date(`${today}T${String(syncConfig.healthCheckHours[0]).padStart(2, "0")}:00:00-03:00`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { action: "HEALTH_CHECK", at: tomorrow.toISOString() };
}

export function consistencyCheckAt(now: Date): string {
  return new Date(now.getTime() + syncConfig.consistencyCheckDelayMinutes * 60_000).toISOString();
}

export function publicationNeedsAttention(now: Date, expectedAt: string | null): boolean {
  if (!expectedAt) return false;
  const elapsed = now.getTime() - Date.parse(expectedAt);
  return Number.isFinite(elapsed) && elapsed >= syncConfig.maxAlertDelayMinutes * 60_000;
}