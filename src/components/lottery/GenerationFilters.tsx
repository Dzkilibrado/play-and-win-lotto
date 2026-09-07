import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

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
import { Switch } from "@/components/ui/switch";
import {
  activeFilterIds,
  countFeasibility,
  describeFilters,
  filterDefinitions,
  filterIds,
  sumFeasibility,
  type FilterContext,
  type FilterId,
  type FilterStates,
} from "@/lib/engine/filters";
import { fibonacciSet, isPrime } from "@/lib/engine/math";
import { cn } from "@/lib/utils";

/** Campo numérico opcional: vazio significa "sem limite". */
function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  placeholder = "—",
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
      {label}
      <input
        inputMode="numeric"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => {
          const raw = event.target.value.replace(/\D/g, "");
          if (raw === "") return onChange(null);
          onChange(Math.min(max, Math.max(min, Number(raw))));
        }}
        className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm tabular-nums text-text-primary"
      />
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-text-secondary">{children}</p>;
}

export function GenerationFilters({
  states,
  onChange,
  context,
  issuesByFilter,
  previousDrawLabel,
  className,
}: {
  states: FilterStates;
  onChange: (next: FilterStates) => void;
  context: FilterContext;
  issuesByFilter: Partial<Record<FilterId, string[]>>;
  previousDrawLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<FilterId | null>(null);
  const active = activeFilterIds(states);
  const enabledIds = filterIds.filter((id) => states[id].enabled);
  const incomplete = enabledIds.filter((id) => !active.includes(id));
  const chips = describeFilters(states, context);

  const update = <K extends FilterId>(id: K, patch: Partial<FilterStates[K]["config"]>) => {
    onChange({
      ...states,
      [id]: { ...states[id], config: { ...states[id].config, ...patch } },
    } as FilterStates);
  };

  const setEnabled = (id: FilterId, enabled: boolean) => {
    onChange({ ...states, [id]: { ...states[id], enabled } } as FilterStates);
    if (enabled) setExpanded(id);
  };

  const openFilter = (id: FilterId) => {
    setExpanded(id);
    setOpen(true);
  };

  const clearAll = () => {
    const cleared = { ...states } as unknown as Record<string, unknown>;
    for (const id of filterIds) {
      cleared[id] = { enabled: false, config: { ...filterDefinitions[id].defaultConfig } };
    }
    onChange(cleared as unknown as FilterStates);
  };

  const sumRange = sumFeasibility(context);
  const parityRange = countFeasibility(context, (value) => value % 2 === 0);
  const primeRange = countFeasibility(context, isPrime);
  const fibs = fibonacciSet(context.rules.universe.max);
  const fibRange = countFeasibility(context, (value) => fibs.has(value));

  const renderConfig = (id: FilterId) => {
    const config = states[id].config as unknown as Record<string, number | null | string>;
    switch (id) {
      case "parity":
        return (
          <>
            <div className="flex gap-2">
              <NumberField
                label="Mínimo de pares"
                value={config["min"] as number | null}
                max={context.numbersCount}
                onChange={(value) => update("parity", { min: value })}
              />
              <NumberField
                label="Máximo de pares"
                value={config["max"] as number | null}
                max={context.numbersCount}
                onChange={(value) => update("parity", { max: value })}
              />
            </div>
            <Hint>
              Os ímpares são o restante do jogo. Com esta configuração é possível de{" "}
              {parityRange.min} a {parityRange.max} pares.
            </Hint>
          </>
        );
      case "sum":
        return (
          <>
            <div className="flex gap-2">
              <NumberField
                label="Soma mínima"
                value={config["min"] as number | null}
                max={9999}
                onChange={(value) => update("sum", { min: value })}
              />
              <NumberField
                label="Soma máxima"
                value={config["max"] as number | null}
                max={9999}
                onChange={(value) => update("sum", { max: value })}
              />
            </div>
            <Hint>
              Com a modalidade, a quantidade de dezenas e suas escolhas atuais, a soma pode ir de{" "}
              {sumRange.min} a {sumRange.max}.
            </Hint>
          </>
        );
      case "rows":
      case "columns": {
        const noun = id === "rows" ? "linha" : "coluna";
        const plural = id === "rows" ? "linhas" : "colunas";
        const total = id === "rows" ? context.rules.grid.rows : context.rules.grid.columns;
        return (
          <>
            <NumberField
              label={`Máximo de dezenas por ${noun}`}
              value={config["maxPerLine"] as number | null}
              min={1}
              max={context.numbersCount}
              onChange={(value) => update(id, { maxPerLine: value })}
            />
            <div className="flex gap-2">
              <NumberField
                label={`Mín. de ${plural} ocupadas`}
                value={config["minOccupied"] as number | null}
                max={total}
                onChange={(value) => update(id, { minOccupied: value })}
              />
              <NumberField
                label={`Máx. de ${plural} ocupadas`}
                value={config["maxOccupied"] as number | null}
                max={total}
                onChange={(value) => update(id, { maxOccupied: value })}
              />
            </div>
            <Hint>
              O volante da {context.rules.name} tem {total} {plural}. A mesma medida é usada na
              análise do jogo.
            </Hint>
          </>
        );
      }
      case "repeated":
        return (
          <>
            <div className="flex gap-2">
              <NumberField
                label="Mínimo de repetidas"
                value={config["min"] as number | null}
                max={context.numbersCount}
                onChange={(value) => update("repeated", { min: value })}
              />
              <NumberField
                label="Máximo de repetidas"
                value={config["max"] as number | null}
                max={context.numbersCount}
                onChange={(value) => update("repeated", { max: value })}
              />
            </div>
            <Hint>{previousDrawLabel}</Hint>
          </>
        );
      case "consecutive":
        return (
          <>
            <NumberField
              label="Máximo de dezenas em sequência"
              value={config["max"] as number | null}
              min={1}
              max={context.numbersCount}
              onChange={(value) => update("consecutive", { max: value })}
            />
            <Hint>Com o máximo 2, o jogo pode ter 10 e 11, mas não 10, 11 e 12.</Hint>
          </>
        );
      case "gapRun":
        return (
          <>
            <NumberField
              label="Máximo de saltos iguais seguidos"
              value={config["max"] as number | null}
              min={1}
              max={Math.max(1, context.numbersCount - 1)}
              onChange={(value) => update("gapRun", { max: value })}
            />
            <Hint>
              Salto é a distância entre duas dezenas vizinhas. Em 05 → 10 → 15 → 20 o intervalo +5
              se repete 3 vezes seguidas. Com o máximo 2, esse jogo é recusado e 05, 10, 15 é
              aceito.
            </Hint>
          </>
        );

      case "fibonacci":
        return (
          <>
            <div className="flex gap-2">
              <NumberField
                label="Mínimo"
                value={config["min"] as number | null}
                max={context.numbersCount}
                onChange={(value) => update("fibonacci", { min: value })}
              />
              <NumberField
                label="Máximo"
                value={config["max"] as number | null}
                max={context.numbersCount}
                onChange={(value) => update("fibonacci", { max: value })}
              />
            </div>
            <Hint>
              A sequência considerada vai até {context.rules.universe.max}. Com esta configuração é
              possível de {fibRange.min} a {fibRange.max} dezenas de Fibonacci no jogo.
            </Hint>
          </>
        );
      case "prime":
        return (
          <>
            <div className="flex gap-2">
              <NumberField
                label="Mínimo"
                value={config["min"] as number | null}
                max={context.numbersCount}
                onChange={(value) => update("prime", { min: value })}
              />
              <NumberField
                label="Máximo"
                value={config["max"] as number | null}
                max={context.numbersCount}
                onChange={(value) => update("prime", { max: value })}
              />
            </div>
            <Hint>
              Com esta configuração é possível de {primeRange.min} a {primeRange.max} primos. O
              número 1 não é primo.
            </Hint>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <section className={cn("surface-card space-y-3 p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label>7. Filtros de geração (opcional)</Label>
          <p className="mt-1 text-xs text-text-secondary">
            {active.length === 0
              ? "Nenhum filtro ativo"
              : `Filtros ativos: ${active.length}`}
            {incomplete.length
              ? ` · ${incomplete.length} ${incomplete.length === 1 ? "ligado sem valor definido" : "ligados sem valores definidos"}`
              : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-11" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="size-4" aria-hidden />
          Configurar filtros
        </Button>
      </div>

      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 rounded-full bg-surface-secondary py-1 pl-1 pr-1 text-xs font-medium text-text-primary"
            >
              <button
                type="button"
                onClick={() => openFilter(chip.id)}
                className="rounded-full px-2 py-0.5"
                aria-label={`Editar filtro ${chip.label}`}
              >
                {chip.summary}
              </button>
              <button
                type="button"
                onClick={() => setEnabled(chip.id, false)}
                aria-label={`Remover filtro ${chip.label}`}
                className="flex size-5 items-center justify-center rounded-full text-text-secondary hover:bg-border"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAll}>
            Limpar filtros
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-text-secondary">
        Os filtros organizam a geração dos jogos conforme critérios escolhidos. Eles não aumentam a
        probabilidade matemática de uma dezena ser sorteada.
      </p>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col">
            <DrawerHeader>
              <DrawerTitle>Filtros de geração</DrawerTitle>
              <DrawerDescription>
                Ative apenas o que quiser. Todos os filtros ativos valem ao mesmo tempo.
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-2">
              {filterIds.map((id) => {
                const definition = filterDefinitions[id];
                const state = states[id];
                const isOpen = expanded === id;
                const issues = issuesByFilter[id] ?? [];
                return (
                  <div key={id} className="rounded-xl border border-border bg-surface">
                    <div className="flex items-center justify-between gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : id)}
                        aria-expanded={isOpen}
                        className="tappable -m-1 flex min-h-11 flex-1 flex-col justify-center rounded-lg p-1 text-left"
                      >
                        <span className="text-sm font-medium text-text-primary">
                          {definition.label}
                        </span>
                        <span className="block text-xs text-text-secondary">
                          {definition.description}
                        </span>
                      </button>
                      <Switch
                        checked={state.enabled}
                        onCheckedChange={(checked) => setEnabled(id, checked)}
                        aria-label={`Ativar filtro ${definition.label}`}
                      />
                    </div>
                    {state.enabled && !active.includes(id) && !isOpen ? (
                      <p className="px-3 pb-3 text-xs text-warning">
                        Ligado, mas ainda sem valores definidos — toque para configurar.
                      </p>
                    ) : null}
                    {isOpen ? (
                      <div className="space-y-2 border-t border-border p-3">
                        {renderConfig(id)}
                        {issues.length ? (
                          <ul className="space-y-1 rounded-lg bg-danger-soft p-2 text-xs text-danger">
                            {issues.map((message) => (
                              <li key={message}>{message}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <DrawerFooter className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={clearAll}>
                Limpar filtros
              </Button>
              <Button className="flex-1" onClick={() => setOpen(false)}>
                Concluir
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
