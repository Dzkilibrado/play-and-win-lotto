import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
    "Fica só para consulta (concursos, prêmios e histórico). Ninguém cria jogos ou bolões novos.",
};

function LotteryEditor({ lottery, onClose }: { lottery: LotteryConfig; onClose: () => void }) {
  const queryClient = useQueryClient();
  const current = useLotteryAvailability();
  const saved = current.availabilityOf(lottery.slug);
  const savedNote = current.noteOf(lottery.slug) ?? "";
  const [status, setStatus] = useState<LotteryAvailability>(saved);
  const [note, setNote] = useState(savedNote);
  const save = useServerFn(setLotteryAvailability);

  const dirty = status !== saved || note.trim() !== savedNote.trim();

  const mutation = useMutation({
    mutationFn: () => save({ data: { slug: lottery.slug, status, note: note.trim() || null } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: lotteryAvailabilityKey });
      toast.success(`${lottery.name}: ${lotteryAvailabilityLabels[status].toLowerCase()}.`);
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar."),
  });

  return (
    <div className="space-y-4 px-4 pb-6">
      <div className="space-y-2" role="group" aria-label={`Situação de ${lottery.name}`}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={status === option}
            onClick={() => setStatus(option)}
            className={cn(
              "flex w-full min-h-14 flex-col items-start rounded-xl border px-4 py-2 text-left transition-colors",
              status === option ? "border-primary bg-primary/10" : "border-border bg-surface",
            )}
          >
            <span className="text-sm font-semibold text-text-primary">
              {lotteryAvailabilityLabels[option]}
            </span>
            <span className="text-xs text-text-secondary">{hint[option]}</span>
          </button>
        ))}
      </div>

      {status !== "ENABLED" ? (
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-text-secondary"
            htmlFor={`note-${lottery.slug}`}
          >
            Aviso exibido ao usuário (opcional)
          </label>
          <Input
            id={`note-${lottery.slug}`}
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: Voltamos em breve."
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" className="h-12 flex-1" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          className="h-12 flex-1"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

/** Habilitar, desabilitar ou pôr em manutenção cada modalidade (somente ADMIN). */
export function LotteryAvailabilityPanel() {
  const current = useLotteryAvailability();
  const [editing, setEditing] = useState<LotteryConfig | null>(null);

  const counts = options.map((option) => ({
    option,
    total: activeLotteries.filter((lottery) => current.availabilityOf(lottery.slug) === option)
      .length,
  }));

  return (
    <section className="space-y-3" aria-labelledby="lottery-availability-title">
      <div>
        <h2
          id="lottery-availability-title"
          className="font-display text-base font-semibold text-text-primary"
        >
          Modalidades
        </h2>
        <p className="text-xs text-text-secondary">
          Toque em uma modalidade para mudar a situação. A trava vale também no banco de dados.
        </p>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Resumo">
        {counts.map(({ option, total }) => (
          <li key={option}>
            <StatusBadge
              label={`${total} ${lotteryAvailabilityLabels[option].toLowerCase()}`}
              tone={tone[option]}
            />
          </li>
        ))}
      </ul>

      <ul className="surface-card divide-y divide-border overflow-hidden">
        {activeLotteries.map((lottery) => {
          const status = current.availabilityOf(lottery.slug);
          return (
            <li key={lottery.slug} data-lottery={lottery.colorKey}>
              <button
                type="button"
                onClick={() => setEditing(lottery)}
                className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-surface-secondary"
                aria-label={`${lottery.name}: ${lotteryAvailabilityLabels[status]}. Alterar situação`}
              >
                <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text-primary">
                  {lottery.name}
                </span>
                <StatusBadge label={lotteryAvailabilityLabels[status]} tone={tone[status]} />
                <ChevronRight className="size-4 shrink-0 text-text-secondary" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <Drawer open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DrawerContent className="max-h-[90vh] overflow-y-auto">
          {editing ? (
            <>
              <DrawerHeader>
                <DrawerTitle>{editing.name}</DrawerTitle>
                <DrawerDescription>Escolha o que o usuário vê.</DrawerDescription>
              </DrawerHeader>
              <LotteryEditor
                key={editing.slug}
                lottery={editing}
                onClose={() => setEditing(null)}
              />
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </section>
  );
}
