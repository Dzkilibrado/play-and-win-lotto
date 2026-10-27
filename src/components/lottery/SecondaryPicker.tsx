import { Shuffle } from "lucide-react";

import { Label } from "@/components/ui/label";
import type { SecondaryOption, SecondaryPoolKind } from "@/config/lotteries";
import { cn } from "@/lib/utils";

interface SecondaryPickerProps {
  id: string;
  /** Rótulo da seleção ("Mês da Sorte", "Time do Coração", "Trevos"). */
  label: string;
  kind: SecondaryPoolKind;
  options: SecondaryOption[];
  /** Escolhas feitas (chaves canônicas); uma só para mês/clube, de 2 a 6 nos trevos. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Mínimo e máximo de escolhas (1–1 para mês/clube). */
  min: number;
  max: number;
  isLoading?: boolean;
}

/** Seleção extra do jogo: mês em botões, clube em lista, trevos em botões múltiplos. */
export function SecondaryPicker({
  id,
  label,
  kind,
  options,
  value,
  onChange,
  min,
  max,
  isLoading,
}: SecondaryPickerProps) {
  const multi = max > 1;

  const draw = () => {
    if (options.length === 0) return;
    const pool = [...options];
    const picks: string[] = [];
    while (picks.length < min && pool.length > 0) {
      const index = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(index, 1)[0]!.value);
    }
    onChange(picks);
  };

  const toggle = (optionValue: string) => {
    if (!multi) {
      onChange([optionValue]);
      return;
    }
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
    } else if (value.length < max) {
      onChange([...value, optionValue]);
    }
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

      {kind === "time" ? (
        options.length > 0 ? (
          <select
            id={id}
            value={value[0] ?? ""}
            onChange={(event) => onChange(event.target.value ? [event.target.value] : [])}
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
        )
      ) : (
        <div
          id={id}
          role={multi ? "group" : "radiogroup"}
          aria-label={label}
          className={cn("grid gap-2", multi ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4")}
        >
          {options.map((option) => {
            const selected = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role={multi ? undefined : "radio"}
                aria-checked={multi ? undefined : selected}
                aria-pressed={multi ? selected : undefined}
                onClick={() => toggle(option.value)}
                className={cn(
                  "touch-target rounded-lg px-2 text-sm font-medium transition-colors",
                  selected
                    ? "bg-lottery text-lottery-foreground"
                    : "bg-surface-secondary text-text-secondary",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {multi ? (
        <p className="text-xs text-text-secondary">
          {value.length} de {max} escolhidos · mínimo {min}. Cada trevo a mais aumenta o preço do
          jogo.
        </p>
      ) : null}
    </div>
  );
}
