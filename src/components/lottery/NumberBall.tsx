import { cn } from "@/lib/utils";

export function NumberBall({
  value,
  variant = "default",
  size = "md",
  className,
}: {
  value: number | string;
  variant?: "default" | "lottery" | "muted" | "hit";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-7 text-xs",
    md: "size-9 text-sm",
    lg: "size-11 text-base",
  };
  const variants = {
    default: "bg-surface-secondary text-text-primary border border-border",
    lottery: "bg-lottery text-lottery-foreground",
    muted: "bg-transparent text-text-secondary border border-border",
    hit: "bg-success text-success-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold tabular-nums",
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {typeof value === "number" ? String(value).padStart(2, "0") : value}
    </span>
  );
}

/** Volante: grade completa do universo da modalidade. */
export function LotteryTicket({
  min,
  max,
  columns,
  selected = [],
  highlighted = [],
  className,
}: {
  min: number;
  max: number;
  columns: number;
  selected?: number[];
  highlighted?: number[];
  className?: string;
}) {
  const numbers = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  return (
    <div
      className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="group"
      aria-label="Volante"
    >
      {numbers.map((number) => (
        <NumberBall
          key={number}
          value={number}
          size="sm"
          className="w-full"
          variant={
            highlighted.includes(number)
              ? "hit"
              : selected.includes(number)
                ? "lottery"
                : "muted"
          }
        />
      ))}
    </div>
  );
}
