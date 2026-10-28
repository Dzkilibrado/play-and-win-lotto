import type { ReactNode } from "react";

import type { AccessRole } from "@/config/accessModules";
import { cn } from "@/lib/utils";

export const statusLabel = { ACTIVE: "Ativo", PENDING: "Pendente", BLOCKED: "Bloqueado" } as const;
export type UserStatus = keyof typeof statusLabel;

export const providerLabel: Record<string, string> = {
  email: "E-mail e senha",
  google: "Google",
};

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-secondary text-text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export const roleTone = (role: AccessRole): Tone =>
  role === "ADMIN" ? "info" : role === "SUPORTE" ? "warning" : "neutral";

export const statusTone = (status: UserStatus): Tone =>
  status === "ACTIVE" ? "success" : status === "BLOCKED" ? "danger" : "warning";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
export const formatDate = (value: string) => dateFormat.format(new Date(value));

export function formatAccess(value: string | null, now = new Date()) {
  if (!value) return "Nunca acessou";
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
  if (day.format(date) === day.format(now)) return `Hoje, ${time}`;
  if (day.format(date) === day.format(new Date(now.getTime() - 86_400_000))) return `Ontem, ${time}`;
  return formatDate(value);
}

/** Opção em forma de "pílula", mais compacta que uma lista suspensa. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-text-secondary hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}
