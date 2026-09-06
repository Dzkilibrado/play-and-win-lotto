import { appConfig } from "@/config/app.config";

const currencyFormatter = new Intl.NumberFormat(appConfig.locale, {
  style: "currency",
  currency: appConfig.currency,
});

const numberFormatter = new Intl.NumberFormat(appConfig.locale);

const dateFormatter = new Intl.DateTimeFormat(appConfig.locale, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return currencyFormatter.format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return numberFormatter.format(value);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const target = new Date(`${value}T12:00:00`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

/** Marcos de contagem regressiva previstos para alertas futuros. */
export const countdownMilestones = [15, 10, 7, 3, 1, 0];
