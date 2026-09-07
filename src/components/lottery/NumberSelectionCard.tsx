/**
 * Divulgação progressiva das dezenas fixas/excluídas.
 * A grade completa só aparece dentro do Drawer dedicado; a tela principal
 * mostra apenas um resumo compacto. Nenhuma regra do motor muda aqui.
 */
import { useEffect, useState } from "react";

import { LotteryNumberGrid } from "@/components/lottery/LotteryNumberGrid";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import type { LotteryRules } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

const PREVIEW_SIZE = 4;

const pad = (value: number) => String(value).padStart(2, "0");

export function summarizeNumbers(values: number[]) {
  if (values.length === 0) return null;
  const head = values.slice(0, PREVIEW_SIZE).map(pad).join(", ");
  const rest = values.length - PREVIEW_SIZE;
  return rest > 0 ? `${head} +${rest}` : head;
}

export function NumberSelectionCard({
  label,
  drawerTitle,
  description,
  drawerDescription,
  value,
  onChange,
  rules,
  /** Dezenas visíveis porém bloqueadas neste quadro (conflito fixo × excluído). */
  locked = [],
  /** Dezenas que não devem aparecer neste quadro. */
  hidden = [],
  /** Dezenas marcadas visualmente como excluídas (leitura). */
  excludedMarks = [],
  /** Mostrado como "3 de 6 selecionadas" quando existir limite aplicável. */
  limit = null,
  notice = null,
  emptyLabel = "Nenhum número selecionado",
  className,
}: {
  label: string;
  drawerTitle?: string;
  description: string;
  drawerDescription: string;
  value: number[];
  onChange: (next: number[]) => void;
  rules: LotteryRules;
  locked?: number[];
  hidden?: number[];
  excludedMarks?: number[];
  limit?: number | null;
  notice?: React.ReactNode | ((openDrawer: () => void) => React.ReactNode);
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(value);

  // Ao abrir, começamos da configuração atual; Cancelar descarta o rascunho.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const lockedSet = new Set(locked);
  const hiddenSet = new Set(hidden);

  const toggle = (number: number) => {
    if (lockedSet.has(number) || hiddenSet.has(number)) return;
    setDraft((prev) =>
      prev.includes(number)
        ? prev.filter((item) => item !== number)
        : [...prev, number].sort((a, b) => a - b),
    );
  };

  const summary = summarizeNumbers(value);
  const counter =
    limit != null
      ? `${draft.length} de ${limit} selecionadas`
      : `${draft.length} ${draft.length === 1 ? "selecionada" : "selecionadas"}`;

  return (
    <section className={cn("surface-card space-y-3 p-4", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0 space-y-1">
          <Label>{label}</Label>
          <p className="text-xs text-text-secondary">{description}</p>
          <p
            className={cn(
              "text-sm font-medium [overflow-wrap:anywhere]",
              summary ? "text-text-primary" : "text-text-secondary",
            )}
          >
            {summary
              ? `${value.length} ${value.length === 1 ? "selecionado" : "selecionados"} · ${summary}`
              : emptyLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button variant="outline" size="sm" className="h-11" onClick={() => setOpen(true)}>
            {value.length ? "Editar" : "Selecionar"}
          </Button>
          {value.length ? (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => onChange([])}>
              Limpar
            </Button>
          ) : null}
        </div>
      </div>

      {typeof notice === "function" ? notice(() => setOpen(true)) : notice}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto flex max-h-[88vh] w-full max-w-lg flex-col">
            <DrawerHeader>
              <DrawerTitle>{drawerTitle ?? label}</DrawerTitle>
              <DrawerDescription>{drawerDescription}</DrawerDescription>
            </DrawerHeader>

            <div className="px-4">
              <p className="text-sm font-medium text-text-primary" role="status" aria-live="polite">
                {counter}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <LotteryNumberGrid
                rules={rules}
                picked={draft}
                excluded={excludedMarks}
                locked={locked}
                hidden={hidden}
                onSelect={toggle}
              />
              {draft.length ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 h-9"
                  onClick={() => setDraft([])}
                >
                  Limpar seleção
                </Button>
              ) : null}
            </div>

            <DrawerFooter className="flex-row gap-2">
              <Button variant="outline" className="h-12 flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="h-12 flex-1"
                onClick={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                Concluir
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
