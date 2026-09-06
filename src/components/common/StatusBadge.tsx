import { cn } from "@/lib/utils";
import type { StatusTone } from "@/types/domain";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-surface-secondary text-text-secondary",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
