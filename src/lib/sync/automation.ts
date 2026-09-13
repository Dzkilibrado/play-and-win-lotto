import { syncConfig } from "@/config/sync.config";

export type AutomationStatus =
  | "UP_TO_DATE"
  | "WAITING_DRAW"
  | "WAITING_PUBLICATION"
  | "SYNCING"
  | "ATTENTION";

export function expectedDrawAt(drawDate: string | null): string | null {
  if (!drawDate) return null;
  return `${drawDate}T${String(syncConfig.officialDrawHour).padStart(2, "0")}:00:00-03:00`;
}

export function retryDelayMinutes(consecutiveFailures: number): number {
  const index = Math.min(Math.max(consecutiveFailures, 0), syncConfig.retryBackoffMinutes.length - 1);
  return syncConfig.retryBackoffMinutes[index] ?? syncConfig.maxRetryDelayMinutes;
}

export function nextRetryAt(now: Date, consecutiveFailures: number): string {
  return new Date(now.getTime() + retryDelayMinutes(consecutiveFailures) * 60_000).toISOString();
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