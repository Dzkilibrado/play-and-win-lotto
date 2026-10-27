/**
 * Painel "Montar por orçamento" — Etapas 1+2+3 do fluxo de criação de jogos
 * por valor disponível:
 *
 * 1. usuário informa o valor disponível;
 * 2. usuário marca em quais modalidades esse valor pode ser usado;
 * 3. sistema calcula a melhor estratégia e apresenta para aprovação —
 *    NENHUM jogo é gerado aqui. Aprovar/ajustar fica a cargo da etapa
 *    seguinte (geração condicionada), que depende de homologação desta.
 */
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { activeLotteries, type LotterySlug } from "@/config/lotteries";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { formatCurrency } from "@/lib/format";
import {
  computeBudgetStrategy,
  type BudgetPriceRow,
  type BudgetStrategyPriority,
  type BudgetStrategyProfile,
  type BudgetStrategyResult,
} from "@/lib/engine/budgetStrategy";

interface BudgetStrategyPanelProps {
  /** Chamado quando o usuário aprova a estratégia proposta. */
  onApprove: (result: BudgetStrategyResult) => void;
}

const priorityOptions: { value: BudgetStrategyPriority; label: string; hint: string }[] = [
  {
    value: "max_games",
    label: "Mais jogos",
    hint: "Mais apostas dentro do valor informado, cada uma com a quantidade mínima de dezenas.",
  },
  {
    value: "max_probability",
    label: "Mais força por jogo",
    hint: "Menos apostas, mas com mais dezenas marcadas em cada uma, aumentando a chance por jogo.",
  },
];

const profileOptions: { value: BudgetStrategyProfile; label: string; hint: string }[] = [
  {
    value: "cost_benefit",
    label: "Melhor custo-benefício",
    hint: "Prioriza a modalidade com melhor cobertura por real investido.",
  },
  {
    value: "max_prize",
    label: "Maiores prêmios",
    hint: "Prioriza modalidades com potencial de prêmio mais alto.",
  },
];

export function BudgetStrategyPanel({ onApprove }: BudgetStrategyPanelProps) {
  const [budgetInput, setBudgetInput] = useState("");
  const [selectedModalities, setSelectedModalities] = useState<LotterySlug[]>([]);
  const [priority, setPriority] = useState<BudgetStrategyPriority>("max_games");
  const [profile, setProfile] = useState<BudgetStrategyProfile>("cost_benefit");
  const [result, setResult] = useState<BudgetStrategyResult | null>(null);

  const lotteryQueries = useQueries({
    queries: activeLotteries.map((lottery) => ({
      queryKey: ["lottery-prices", lottery.slug],
      queryFn: async (): Promise<BudgetPriceRow[]> => {
        const rows = await lotteryDataService.listPrices(lottery.slug);
        return rows.map(
          (row: { numbers_selected: number; price: number; combination_count: number }) => ({
            numbersSelected: row.numbers_selected,
            price: Number(row.price),
            combinationCount: Number(row.combination_count),
          }),
        );
      },
    })),
  });

  const pricesLoading = lotteryQueries.some((query) => query.isLoading);
  const pricesBySlug = useMemo(() => {
    const map: Record<string, BudgetPriceRow[]> = {};
    activeLotteries.forEach((lottery, index) => {
      map[lottery.slug] = lotteryQueries[index]?.data ?? [];
    });
    return map;
  }, [lotteryQueries]);

  const toggleModality = (slug: LotterySlug) => {
    setResult(null);
    setSelectedModalities((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug],
    );
  };

  const budgetValue = Number(budgetInput.replace(",", "."));
  const canCalculate =
    Number.isFinite(budgetValue) && budgetValue > 0 && selectedModalities.length > 0;

  const handleCalculate = () => {
    if (!canCalculate) return;
    setResult(
      computeBudgetStrategy({
        budget: budgetValue,
        modalities: selectedModalities,
        priority,
        profile,
        pricesBySlug,
      }),
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Valor disponível para jogar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="budget-input">Valor (R$)</Label>
            <input
              id="budget-input"
              inputMode="decimal"
              placeholder="Ex.: 50"
              value={budgetInput}
              onChange={(event) => {
                setBudgetInput(event.target.value);
                setResult(null);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label>2. Em quais loterias usar esse valor?</Label>
            <div className="flex flex-wrap gap-4">
              {activeLotteries.map((lottery) => (
                <label
                  key={lottery.slug}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <Checkbox
                    checked={selectedModalities.includes(lottery.slug)}
                    onCheckedChange={() => toggleModality(lottery.slug)}
                  />
                  <span className="text-sm">{lottery.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Prioridade de cada jogo</Label>
            <ToggleGroup
              type="single"
              value={priority}
              onValueChange={(value) => {
                if (value) {
                  setPriority(value as BudgetStrategyPriority);
                  setResult(null);
                }
              }}
              className="justify-start flex-wrap"
            >
              {priorityOptions.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} aria-label={option.label}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {priorityOptions.find((option) => option.value === priority)?.hint}
            </p>
          </div>

          {selectedModalities.length > 1 && (
            <div className="space-y-1.5">
              <Label>Como dividir entre as loterias marcadas</Label>
              <ToggleGroup
                type="single"
                value={profile}
                onValueChange={(value) => {
                  if (value) {
                    setProfile(value as BudgetStrategyProfile);
                    setResult(null);
                  }
                }}
                className="justify-start flex-wrap"
              >
                {profileOptions.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={option.label}
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {profileOptions.find((option) => option.value === profile)?.hint}
              </p>
            </div>
          )}

          <Button onClick={handleCalculate} disabled={!canCalculate || pricesLoading}>
            {pricesLoading ? "Carregando preços..." : "Calcular estratégia"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Estratégia proposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.allocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {result.warnings[0] ?? "Não foi possível montar uma estratégia com esse valor."}
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {result.allocations.map((allocation) => (
                    <div
                      key={allocation.slug}
                      className="rounded-md border border-border p-3 space-y-1"
                    >
                      <p className="text-sm font-medium">{allocation.name}</p>
                      <ul className="space-y-0.5">
                        {allocation.lines.map((line) => (
                          <li key={line.numbersSelected} className="text-sm text-muted-foreground">
                            {line.gamesCount} {line.gamesCount === 1 ? "jogo" : "jogos"} de{" "}
                            {line.numbersSelected} dezenas — {formatCurrency(line.pricePerGame)}{" "}
                            cada
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm">
                        {allocation.totalGamesCount}{" "}
                        {allocation.totalGamesCount === 1 ? "jogo no total" : "jogos no total"} —
                        Total: <strong>{formatCurrency(allocation.totalCost)}</strong>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="text-sm space-y-1 border-t border-border pt-3">
                  <p>
                    Total da estratégia: <strong>{formatCurrency(result.totalCost)}</strong>
                  </p>
                  {result.totalLeftover > 0 && (
                    <p className="text-muted-foreground">
                      Sobra não utilizada: {formatCurrency(result.totalLeftover)}
                    </p>
                  )}
                </div>

                {result.warnings.map((warning, index) => (
                  <p key={index} className="text-xs text-amber-600 dark:text-amber-400">
                    {warning}
                  </p>
                ))}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={() => onApprove(result)}>Seguir com esta estratégia</Button>
                  <Button variant="outline" onClick={() => setResult(null)}>
                    Ajustar valor ou modalidades
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
