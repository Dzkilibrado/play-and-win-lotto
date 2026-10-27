import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  activeLotteries,
  lotteryAvailabilityLabels,
  type LotteryAvailability,
  type LotteryConfig,
} from "@/config/lotteries";
import { lotteryAvailabilityKey, useLotteryAvailability } from "@/hooks/useLotteryAvailability";
import { setLotteryAvailability } from "@/lib/admin/lotteries.functions";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/types/domain";

const options: LotteryAvailability[] = ["ENABLED", "MAINTENANCE", "DISABLED"];

const tone: Record<LotteryAvailability, StatusTone> = {
  ENABLED: "success",
  MAINTENANCE: "warning",
  DISABLED: "neutral",
};

const hint: Record<LotteryAvailability, string> = {
  ENABLED: "Os usuários criam jogos e bolões normalmente.",
  MAINTENANCE:
    "Aparece com aviso de manutenção. Ninguém cria jogos ou bolões novos; o que já existe continua visível.",
  DISABLED:
    "Some das listas. Ninguém cria jogos ou bolões novos; o que o usuário já tem continua consultável.",
};

function LotteryRow({ lottery }: { lottery: LotteryConfig }) {
  const queryClient = useQueryClient();
  const current = useLotteryAvailability();
  const saved = current.availabilityOf(lottery.slug);
  const savedNote = current.noteOf(lottery.slug) ?? "";
  const [status, setStatus] = useState<LotteryAvailability | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const save = useServerFn(setLotteryAvailability);

  const selected = status ?? saved;
  const noteValue = note ?? savedNote;
  const dirty = selected !== saved || (note !== null && note.trim() !== savedNote.trim());

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: { slug: lottery.slug, status: selected, note: noteValue.trim() || null },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: lotteryAvailabilityKey });
      setStatus(null);
      setNote(null);
      toast.success(`${lottery.name}: ${lotteryAvailabilityLabels[selected].toLowerCase()}.`);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });

  return (
    <li className="space-y-3 rounded-lg border border-border p-3" data-lottery={lottery.colorKey}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-text-primary">{lottery.name}</span>
        <StatusBadge label={lotteryAvailabilityLabels[saved]} tone={tone[saved]} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={`Situação de ${lottery.name}`}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={selected === option}
            onClick={() => setStatus(option)}
            className={cn(
              "touch-target rounded-full px-4 text-sm font-medium transition-colors",
              selected === option
                ? "bg-primary text-primary-foreground"
                : "bg-surface-secondary text-text-secondary",
            )}
          >
            {lotteryAvailabilityLabels[option]}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-secondary">{hint[selected]}</p>

      {selected !== "ENABLED" ? (
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-text-secondary"
            htmlFor={`note-${lottery.slug}`}
          >
            Aviso exibido ao usuário (opcional)
          </label>
          <Input
            id={`note-${lottery.slug}`}
            value={noteValue}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: Voltamos em breve."
          />
        </div>
      ) : null}

      <Button
        size="sm"
        className="h-11"
        disabled={!dirty || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Salvando…" : "Salvar alteração"}
      </Button>
    </li>
  );
}

/** Habilitar, desabilitar ou pôr em manutenção cada modalidade (somente ADMIN). */
export function LotteryAvailabilityPanel() {
  return (
    <section className="surface-card space-y-3 p-4" aria-labelledby="lottery-availability-title">
      <div>
        <h2
          id="lottery-availability-title"
          className="font-display text-sm font-semibold text-text-primary"
        >
          Modalidades
        </h2>
        <p className="text-xs text-text-secondary">
          Escolha, uma a uma, o que o usuário vê. A trava vale também no banco de dados.
        </p>
      </div>
      <ul className="space-y-3">
        {activeLotteries.map((lottery) => (
          <LotteryRow key={lottery.slug} lottery={lottery} />
        ))}
      </ul>
    </section>
  );
}
