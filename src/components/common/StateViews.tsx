import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: "neutral" | "positive";
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actions,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col items-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          tone === "positive" ? "bg-success-soft text-success" : "bg-surface-secondary text-text-secondary",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-text-primary">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-text-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap justify-center gap-2 pt-1">{actions}</div> : null}
    </div>
  );
}

export function LoadingState({ rows = 3, label = "Carregando…" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar",
  description = "Tente novamente em instantes.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="surface-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-text-primary">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-text-secondary">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
