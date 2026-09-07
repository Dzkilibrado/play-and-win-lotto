import { Scale } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
import { NumberBall } from "@/components/lottery/NumberBall";
import {
  weightIntensityLabels,
  weightStrategies,
  weightStrategyIds,
  weightWindows,
  weightsConfig,
  weightsDisclaimer,
  weightsExplanation,
  windowLabel,
  type WeightIntensity,
  type WeightStrategyId,
} from "@/config/weights.config";
import {
  selectionForStrategy,
  validateWeightSelection,
  type NumberWeight,
  type StatisticsSnapshot,
  type WeightSelection,
} from "@/lib/engine/weights";
import type { LotteryColorKey } from "@/config/lotteries";
import { cn } from "@/lib/utils";

/** Resumo curto da estratégia, usado no chip e no cabeçalho da seção. */
export function describeWeightSelection(selection: WeightSelection): string {
  const definition = weightStrategies[selection.strategyId];
  if (selection.strategyId === "none") return definition.label;
  const parts = [definition.label, `influência ${weightIntensityLabels[selection.intensity].toLowerCase()}`];
  if (definition.windowConfigurable) {
    parts.push(selection.window === null ? "todos os concursos" : `últimos ${selection.window}`);
  }
  return parts.join(" · ");
}

function levelLabel(value: number) {
  if (value >= 0.66) return "alta";
  if (value >= 0.33) return "média";
  return "baixa";
}

function CustomSliders({
  selection,
  onChange,
}: {
  selection: WeightSelection;
  onChange: (next: WeightSelection) => void;
}) {
  const total =
    selection.custom.recent + selection.custom.historical + selection.custom.delay;
  const fields: { key: keyof WeightSelection["custom"]; label: string }[] = [
    { key: "recent", label: "Frequência recente" },
    { key: "historical", label: "Frequência histórica" },
    { key: "delay", label: "Atraso" },
  ];

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>{field.label}</span>
            <span className="tabular-nums text-text-primary">{selection.custom[field.key]}%</span>
          </div>
          <Slider
            value={[selection.custom[field.key]]}
            min={0}
            max={100}
            step={5}
            aria-label={field.label}
            onValueChange={([value]) =>
              onChange({
                ...selection,
                custom: { ...selection.custom, [field.key]: value ?? 0 },
              })
            }
          />
        </div>
      ))}
      <p className={cn("text-xs", total === 100 ? "text-text-secondary" : "text-danger")}>
        Soma atual: {total}% {total === 100 ? "" : "— ajuste para chegar a 100%."}
      </p>
    </div>
  );
}

export function SmartWeights({
  selection,
  onChange,
  weights,
  snapshot,
  loading,
  error,
  colorKey,
  className,
}: {
  selection: WeightSelection;
  onChange: (next: WeightSelection) => void;
  weights: NumberWeight[] | null;
  snapshot: StatisticsSnapshot | null;
  loading: boolean;
  error: boolean;
  colorKey: LotteryColorKey;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const issues = validateWeightSelection(selection);
  const active = selection.strategyId !== "none";
  const ranked = weights ? [...weights].sort((a, b) => b.finalWeight - a.finalWeight) : [];
  const preview = ranked.slice(0, weightsConfig.previewSize);

  return (
    <section className={cn("surface-card space-y-3 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label>8. Pesos inteligentes (opcional)</Label>
          <p className="text-xs text-text-secondary">
            Define a preferência do gerador ao escolher as dezenas, com base em critérios
            históricos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Scale className="mr-1 size-4" aria-hidden />
          Configurar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-text-primary">
          {describeWeightSelection(selection)}
        </span>
        {active && snapshot ? (
          <span className="text-xs text-text-secondary">
            {snapshot.contestsAnalyzed} concursos considerados
            {snapshot.lastContestConsidered ? ` (até o ${snapshot.lastContestConsidered})` : ""}
          </span>
        ) : null}
        {active && loading ? (
          <span className="text-xs text-text-secondary">Carregando o histórico…</span>
        ) : null}
        {active && error ? (
          <span className="text-xs text-warning">
            Não foi possível carregar o histórico agora — a geração segue sem pesos.
          </span>
        ) : null}
      </div>

      {issues.length ? (
        <ul className="space-y-1 rounded-lg bg-danger-soft p-2 text-xs text-danger">
          {issues.map((issue) => (
            <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-text-secondary">{weightsExplanation}</p>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col">
            <DrawerHeader>
              <DrawerTitle>Pesos inteligentes</DrawerTitle>
              <DrawerDescription>{weightsExplanation}</DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-2">
              <div className="grid gap-2">
                {weightStrategyIds.map((id: WeightStrategyId) => {
                  const definition = weightStrategies[id];
                  const chosen = selection.strategyId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => onChange(selectionForStrategy(selection, id))}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        chosen
                          ? "border-lottery bg-lottery-soft"
                          : "border-border bg-surface hover:bg-surface-secondary",
                      )}
                    >
                      <span className="block text-sm font-medium text-text-primary">
                        {definition.label}
                      </span>
                      <span className="block text-xs text-text-secondary">
                        {definition.description}
                      </span>
                      {chosen && definition.notice ? (
                        <span className="mt-1 block text-xs text-warning">{definition.notice}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {selection.strategyId === "custom" ? (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <Label>Como cada indicador influencia</Label>
                  <CustomSliders selection={selection} onChange={onChange} />
                </div>
              ) : null}

              {active && weightStrategies[selection.strategyId].windowConfigurable ? (
                <div className="space-y-2">
                  <Label>Período analisado</Label>
                  <div className="flex flex-wrap gap-2">
                    {weightWindows.map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        aria-pressed={selection.window === value}
                        onClick={() => onChange({ ...selection, window: value })}
                        className={cn(
                          "touch-target rounded-full px-4 text-xs font-medium",
                          selection.window === value
                            ? "bg-lottery text-lottery-foreground"
                            : "bg-surface-secondary text-text-secondary",
                        )}
                      >
                        {windowLabel(value)}
                      </button>
                    ))}
                  </div>
                  {snapshot && selection.window !== null && snapshot.windowContests < selection.window ? (
                    <p className="text-xs text-text-secondary">
                      Esta modalidade tem {snapshot.windowContests} concursos disponíveis no
                      período; foram usados todos eles.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {active ? (
                <div className="space-y-2">
                  <Label>Influência</Label>
                  <div className="flex gap-2">
                    {(["low", "medium", "high"] as WeightIntensity[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selection.intensity === value}
                        onClick={() => onChange({ ...selection, intensity: value })}
                        className={cn(
                          "touch-target flex-1 rounded-lg border text-sm font-medium",
                          selection.intensity === value
                            ? "border-lottery bg-lottery text-lottery-foreground"
                            : "border-border bg-surface text-text-primary",
                        )}
                      >
                        {weightIntensityLabels[value]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-text-secondary">
                    Controla o quanto a preferência varia entre as dezenas. Mesmo na influência
                    alta, nenhuma dezena disponível fica de fora.
                  </p>
                </div>
              ) : null}

              {active && preview.length ? (
                <div className="space-y-2" data-lottery={colorKey}>
                  <Label>Maior peso na geração</Label>
                  <div className="flex flex-wrap gap-2">
                    {preview.map((item) => (
                      <NumberBall key={item.number} value={item.number} size="sm" />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setShowAll((value) => !value)}
                  >
                    {showAll ? "Ocultar detalhes" : "Ver todas"}
                  </Button>
                  {showAll ? (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-surface-secondary text-text-secondary">
                          <tr>
                            <th className="p-2">Dezena</th>
                            <th className="p-2">Recente</th>
                            <th className="p-2">Histórica</th>
                            <th className="p-2">Atraso</th>
                            <th className="p-2">Peso</th>
                          </tr>
                        </thead>
                        <tbody className="text-text-primary">
                          {ranked.map((item) => (
                            <tr key={item.number} className="border-t border-border">
                              <td className="p-2 tabular-nums">
                                {String(item.number).padStart(2, "0")}
                              </td>
                              <td className="p-2">
                                {levelLabel(item.statistics.normalizedRecentFrequency)}
                              </td>
                              <td className="p-2">
                                {levelLabel(item.statistics.normalizedHistoricalFrequency)}
                              </td>
                              <td className="p-2 tabular-nums">
                                {item.statistics.drawsSinceLastAppearance}
                              </td>
                              <td className="p-2 tabular-nums">
                                {item.finalWeight.toFixed(2).replace(".", ",")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <p className="rounded-lg bg-surface-secondary p-3 text-xs text-text-secondary">
                {weightsDisclaimer}
              </p>
            </div>

            <DrawerFooter className="flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onChange(selectionForStrategy(selection, "none"))}
              >
                Sem pesos
              </Button>
              <Button className="flex-1" disabled={issues.length > 0} onClick={() => setOpen(false)}>
                Concluir
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
