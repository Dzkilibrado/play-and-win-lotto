import { Timer } from "lucide-react";

import { poolConfig } from "@/config/pools.config";
import { daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Contagem regressiva até o sorteio.
 * Só aparece quando há data conhecida; nunca inventa prazo.
 */
export function PoolCountdown({
  date,
  className,
}: {
  date: string | null | undefined;
  className?: string;
}) {
  const days = daysUntil(date);
  if (days === null || days < 0) return null;

  const milestone = poolConfig.countdownMilestones.find((value) => days <= value) ?? null;
  const urgent = milestone !== null && milestone <= 3;

  const text =
    days === 0 ? "Sorteio é hoje" : days === 1 ? "Falta 1 dia para o sorteio" : `Faltam ${days} dias para o sorteio`;

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium",
        urgent ? "bg-warning-soft text-warning" : "bg-surface-secondary text-text-secondary",
        className,
      )}
    >
      <Timer className="size-3.5" aria-hidden />
      {text}
    </p>
  );
}
