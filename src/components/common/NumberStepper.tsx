/**
 * Controle numérico compacto: [-] [valor] [+].
 *
 * Substitui listas longas de botões. O valor central aceita digitação —
 * o usuário não precisa tocar seis vezes para sair de 6 e chegar a 12.
 * Limites (min/max/step) vêm sempre de quem usa o componente, nunca daqui.
 */
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function NumberStepper({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  hint,
  disabled = false,
  className,
}: {
  id: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Descrição acessível do que está sendo contado. */
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  // Enquanto digita, o campo guarda o texto cru: apagar tudo é permitido.
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(String(value));
    setError(null);
  }, [value]);

  const clampAndCommit = (raw: string) => {
    const parsed = Number(raw);
    if (!raw.trim() || !Number.isFinite(parsed)) {
      setDraft(String(value));
      setError(null);
      return;
    }
    const rounded = Math.trunc(parsed);
    if (rounded < min || rounded > max) {
      setError(`Escolha um valor entre ${min} e ${max}.`);
      setDraft(String(rounded));
      return;
    }
    setError(null);
    onChange(rounded);
  };

  const nudge = (direction: 1 | -1) => {
    const next = value + direction * step;
    if (next < min || next > max) return;
    onChange(next);
  };

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={disabled || atMin}
          aria-label={`Diminuir ${label}`}
          className="grid size-12 shrink-0 place-items-center text-text-primary transition-colors hover:bg-surface-secondary disabled:opacity-40"
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={label}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          value={draft}
          onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
          onBlur={(event) => clampAndCommit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              clampAndCommit((event.target as HTMLInputElement).value);
            }
          }}
          className="h-12 w-16 border-x border-border bg-surface text-center font-display text-lg font-semibold tabular-nums text-text-primary outline-none focus-visible:bg-surface-secondary"
        />
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={disabled || atMax}
          aria-label={`Aumentar ${label}`}
          className="grid size-12 shrink-0 place-items-center text-text-primary transition-colors hover:bg-surface-secondary disabled:opacity-40"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>

      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}
