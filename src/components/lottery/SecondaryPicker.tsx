import { Shuffle } from "lucide-react";

import { Label } from "@/components/ui/label";
import type { SecondaryOption, SecondaryPoolKind } from "@/config/lotteries";
import { cn } from "@/lib/utils";

interface SecondaryPickerProps {
  id: string;
  /** Rótulo da seleção ("Mês da Sorte", "Time do Coração"). */
  label: string;
  kind: SecondaryPoolKind;
  options: SecondaryOption[];
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
}

/** Escolha única da seleção secundária: mês em botões, clube em lista. */
export function SecondaryPicker({
  id,
  label,
  kind,
  options,
  value,
  onChange,
  isLoading,
}: SecondaryPickerProps) {
  const draw = () => {
    if (options.length === 0) return;
    const pick = options[Math.floor(Math.random() * options.length)];
    if (pick) onChange(pick.value);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <button
          type="button"
          onClick={draw}
          disabled={options.length === 0}
          className="tappable inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-secondary px-3 text-xs font-medium text-text-primary disabled:opacity-50"
        >
          <Shuffle className="size-3.5" aria-hidden />
          Sortear
        </button>
      </div>

      {kind === "mes" ? (
        <div
          id={id}
          role="radiogroup"
          aria-label={label}
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={value === option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                "touch-target rounded-lg px-2 text-sm font-medium transition-colors",
                value === option.value
                  ? "bg-lottery text-lottery-foreground"
                  : "bg-surface-secondary text-text-secondary",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : options.length > 0 ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
        >
          <option value="">Escolha um clube</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <p
          id={id}
          className="rounded-lg bg-surface-secondary px-3 py-2 text-sm text-text-secondary"
        >
          {isLoading
            ? "Carregando clubes…"
            : "Os clubes desta modalidade ainda não foram cadastrados pela administração."}
        </p>
      )}
    </div>
  );
}
