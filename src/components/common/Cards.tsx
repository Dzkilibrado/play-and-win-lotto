import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Indicador clicável: leva a uma listagem já filtrada.
 * Sem `to`, vira um cartão estático.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
  search,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  to?: string;
  search?: Record<string, string>;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneRing: Record<string, string> = {
    neutral: "text-text-secondary bg-surface-secondary",
    success: "text-success bg-success-soft",
    warning: "text-warning bg-warning-soft",
    danger: "text-danger bg-danger-soft",
    info: "text-info bg-info-soft",
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", toneRing[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-text-primary">{value}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        {hint ? <span className="text-xs text-text-secondary">{hint}</span> : <span />}
        {to ? <ChevronRight className="size-4 text-text-secondary" aria-hidden /> : null}
      </div>
    </>
  );

  if (!to) {
    return <div className="surface-card p-4">{content}</div>;
  }

  return (
    <Link
      to={to}
      search={search ?? {}}
      className="surface-card block p-4 transition-colors hover:bg-surface-secondary focus-visible:bg-surface-secondary"
    >
      {content}
    </Link>
  );
}

/** Métrica compacta usada dentro de cartões maiores. */
export function MetricCard({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-surface-secondary px-3 py-2", className)}>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="font-display text-base font-semibold text-text-primary">{value}</p>
    </div>
  );
}
