import { Check, X } from "lucide-react";

import { universeNumbers } from "@/lib/engine/rules";
import type { LotteryRules } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

export type NumberState = "free" | "fixed" | "excluded" | "picked";

/**
 * Volante virtual reutilizável (seleção e apenas leitura).
 * Estados nunca dependem só de cor: há ícone, borda e aria-label.
 */
export function LotteryNumberGrid({
  rules,
  fixed = [],
  excluded = [],
  picked = [],
  onSelect,
  readOnly = false,
  className,
}: {
  rules: LotteryRules;
  fixed?: number[];
  excluded?: number[];
  picked?: number[];
  onSelect?: (value: number) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const fixedSet = new Set(fixed);
  const excludedSet = new Set(excluded);
  const pickedSet = new Set(picked);

  const stateOf = (value: number): NumberState => {
    if (fixedSet.has(value)) return "fixed";
    if (excludedSet.has(value)) return "excluded";
    if (pickedSet.has(value)) return "picked";
    return "free";
  };

  const labels: Record<NumberState, string> = {
    free: "livre",
    fixed: "fixado",
    excluded: "excluído",
    picked: "no jogo",
  };

  return (
    <div
      className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(2.75rem, 1fr))" }}
      role="group"
      aria-label={`Volante da ${rules.name}`}
    >
      {universeNumbers(rules).map((value) => {
        const state = stateOf(value);
        const content = (
          <>
            <span className="tabular-nums">{String(value).padStart(2, "0")}</span>
            {state === "fixed" ? (
              <Check className="absolute right-0.5 top-0.5 size-3" aria-hidden />
            ) : null}
            {state === "excluded" ? (
              <X className="absolute right-0.5 top-0.5 size-3" aria-hidden />
            ) : null}
          </>
        );

        const classes = cn(
          "relative flex h-11 w-full items-center justify-center rounded-lg border font-display text-sm font-semibold transition-colors",
          state === "free" && "border-border bg-surface text-text-primary",
          state === "fixed" && "border-lottery bg-lottery text-lottery-foreground",
          state === "excluded" &&
            "border-danger border-dashed bg-danger-soft text-danger line-through opacity-90",
          state === "picked" && "border-lottery bg-lottery text-lottery-foreground",
        );

        if (readOnly || !onSelect) {
          return (
            <span
              key={value}
              className={classes}
              aria-label={`Número ${value} ${labels[state]}`}
            >
              {content}
            </span>
          );
        }

        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            aria-pressed={state !== "free"}
            aria-label={`Número ${value} ${labels[state]}`}
            className={cn(classes, "hover:border-lottery focus-visible:ring-2 focus-visible:ring-lottery")}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
