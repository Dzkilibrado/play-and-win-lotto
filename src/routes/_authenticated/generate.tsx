import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { GameCard } from "@/components/lottery/GameCard";
import { LotteryNumberGrid } from "@/components/lottery/LotteryNumberGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { generationConfig } from "@/config/generation.config";
import { activeLotteries, type LotterySlug } from "@/config/lotteries";
import { useSession } from "@/hooks/useAuth";
import { generateGames } from "@/lib/engine/generator";
import { allowedNumbersCounts, resolveRules } from "@/lib/engine/rules";
import { validateGenerationRequest } from "@/lib/engine/validator";
import type { GeneratedGameDraft } from "@/lib/engine/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { gameService } from "@/lib/services/gameService";
import { validateListSearch } from "@/lib/searchFilters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/generate")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Criar jogo — ${appConfig.name}` },
      { name: "description", content: "Monte jogos com dezenas fixas, exclusões e análise." },
      { property: "og:title", content: `Criar jogo — ${appConfig.name}` },
      {
        property: "og:description",
        content: "Monte jogos com dezenas fixas, exclusões e análise completa.",
      },
    ],
  }),
  component: GeneratePage,
});

type ContestChoice = "next" | "custom" | "none";

function GeneratePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = useSession();

  const initialSlug = (search.lottery as LotterySlug | undefined) ?? activeLotteries[0]!.slug;
  const [slug, setSlug] = useState<LotterySlug>(initialSlug);
  const rules = resolveRules(slug)!;

  const [numbersCount, setNumbersCount] = useState(rules.selectable.base);
  const [gamesCount, setGamesCount] = useState(1);
  const [fixed, setFixed] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [contestChoice, setContestChoice] = useState<ContestChoice>("next");
  const [customContest, setCustomContest] = useState("");
  const [games, setGames] = useState<GeneratedGameDraft[] | null>(null);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPriceHelp, setShowPriceHelp] = useState(false);

  const lotteriesQuery = useQuery({
    queryKey: ["lotteries"],
    queryFn: () => lotteryDataService.listLotteries(),
  });
  const lotteryRow = lotteriesQuery.data?.find((row) => row.slug === slug) ?? null;

  const priceQuery = useQuery({
    queryKey: ["price", lotteryRow?.id, numbersCount],
    enabled: Boolean(lotteryRow?.id),
    queryFn: () => lotteryDataService.getActivePrice(lotteryRow!.id, numbersCount),
  });

  const lastDrawQuery = useQuery({
    queryKey: ["last-draw", slug],
    queryFn: async () => (await lotteryDataService.listRecentResults(slug, 1))[0] ?? null,
  });
  const lastDraw = lastDrawQuery.data ?? null;
  const lastNumbers = lastDraw?.draw_numbers?.map((item) => item.number) ?? null;
  const nextContest = lastDraw?.next_contest_number ?? (lastDraw ? lastDraw.contest_number + 1 : null);

  const changeLottery = (next: LotterySlug) => {
    const nextRules = resolveRules(next)!;
    setSlug(next);
    setNumbersCount(nextRules.selectable.base);
    setFixed([]);
    setExcluded([]);
    setGames(null);
    setSavedKeys([]);
    void navigate({ search: (prev) => ({ ...prev, lottery: next }) });
  };

  const toggleFixed = (value: number) => {
    // Uma dezena excluída não pode virar fixa por toque: o usuário desfaz a exclusão antes.
    if (excluded.includes(value)) return;
    setGames(null);
    setFixed((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value].sort((a, b) => a - b),
    );
  };

  const toggleExcluded = (value: number) => {
    // Dezenas fixas nem aparecem neste quadro; a guarda evita troca implícita.
    if (fixed.includes(value)) return;
    setGames(null);
    setExcluded((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value].sort((a, b) => a - b),
    );
  };


  const request = useMemo(
    () => ({ lotterySlug: slug, numbersCount, gamesCount, fixed, excluded }),
    [slug, numbersCount, gamesCount, fixed, excluded],
  );
  const validation = useMemo(() => validateGenerationRequest(request), [request]);

  const universeSize = rules.universe.max - rules.universe.min + 1;
  const availableCount = universeSize - fixed.length - excluded.length;

  const unitPrice = priceQuery.data?.price ?? null;
  const totalPrice = unitPrice != null ? unitPrice * gamesCount : null;
  const combinationCount = priceQuery.data?.combination_count ?? null;

  const contestNumber =
    contestChoice === "none"
      ? null
      : contestChoice === "next"
        ? nextContest
        : Number(customContest) || null;

  const handleGenerate = () => {
    const outcome = generateGames(request, {
      analyzer: {
        lastDrawNumbers: lastNumbers,
        lastContestNumber: lastDraw?.contest_number ?? null,
      },
    });
    if (!outcome.validation.ok) {
      toast.error(outcome.validation.issues[0]?.message ?? "Configuração inválida.");
      return;
    }
    setGames(outcome.games);
    setSavedKeys([]);
  };

  const saveGames = async (drafts: GeneratedGameDraft[]) => {
    if (!user?.id || !lotteryRow) {
      toast.error("Sessão não identificada. Entre novamente.");
      return;
    }
    setSaving(true);
    try {
      for (const draft of drafts) {
        await gameService.saveGame({
          userId: user.id,
          lotteryId: lotteryRow.id,
          numbers: draft.numbers,
          analysis: draft.analysis,
          contestNumber,
          drawId: null,
          price:
            priceQuery.data && unitPrice != null
              ? {
                  priceId: priceQuery.data.id,
                  price: unitPrice,
                  combinationCount: priceQuery.data.combination_count,
                  source: priceQuery.data.source,
                }
              : null,
        });
      }
      setSavedKeys((prev) => [...prev, ...drafts.map((draft) => draft.key)]);
      toast.success(drafts.length === 1 ? "Jogo salvo." : `${drafts.length} jogos salvos.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-28" data-lottery={rules.colorKey}>
      <PageHeader
        title="Criar jogo"
        description="Escolha a modalidade, as dezenas e gere quantos jogos quiser. Nada é salvo sem sua confirmação."
      />

      {games ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleGenerate}>Criar novamente</Button>
            <Button variant="outline" onClick={() => setGames(null)}>
              Editar configuração
            </Button>
            <Button
              variant="secondary"
              disabled={saving || savedKeys.length === games.length}
              onClick={() => void saveGames(games.filter((game) => !savedKeys.includes(game.key)))}
            >
              Salvar todos
            </Button>
            <span className="text-xs text-text-secondary">
              {games.length} jogos · {formatCurrency(totalPrice)}
              {contestNumber ? ` · concurso ${contestNumber}` : " · sem concurso"}
            </span>
          </div>

          {games.map((game) => (
            <GameCard
              key={game.key}
              title={`Jogo ${String(game.index).padStart(2, "0")}`}
              numbers={game.numbers}
              analysis={game.analysis}
              lotteryName={rules.name}
              colorKey={rules.colorKey}
              contestNumber={contestNumber}
              cost={unitPrice}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || savedKeys.includes(game.key)}
                  onClick={() => void saveGames([game])}
                >
                  {savedKeys.includes(game.key) ? "Salvo" : "Salvar jogo"}
                </Button>
              }
            />
          ))}
        </section>
      ) : (
        <>
          <section className="surface-card space-y-4 p-4">
            <div className="space-y-2">
              <Label>1. Modalidade</Label>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Modalidade">
                {activeLotteries.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    role="tab"
                    aria-selected={item.slug === slug}
                    data-lottery={item.colorKey}
                    onClick={() => changeLottery(item.slug)}
                    className={cn(
                      "touch-target rounded-full px-4 text-sm font-medium transition-colors",
                      item.slug === slug
                        ? "bg-lottery text-lottery-foreground"
                        : "bg-surface-secondary text-text-secondary",
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>2. Dezenas por jogo</Label>
              <div className="flex flex-wrap gap-2">
                {allowedNumbersCounts(rules).map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={count === numbersCount}
                    onClick={() => {
                      setNumbersCount(count);
                      setGames(null);
                    }}
                    className={cn(
                      "h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold tabular-nums",
                      count === numbersCount
                        ? "border-lottery bg-lottery text-lottery-foreground"
                        : "border-border bg-surface text-text-primary",
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="games-count">3. Quantidade de jogos</Label>
              <div className="flex flex-wrap items-center gap-2">
                {generationConfig.quickGameCounts.map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={count === gamesCount}
                    onClick={() => setGamesCount(count)}
                    className={cn(
                      "h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold tabular-nums",
                      count === gamesCount
                        ? "border-lottery bg-lottery text-lottery-foreground"
                        : "border-border bg-surface text-text-primary",
                    )}
                  >
                    {count}
                  </button>
                ))}
                <input
                  id="games-count"
                  inputMode="numeric"
                  aria-label="Quantidade personalizada de jogos"
                  value={gamesCount}
                  onChange={(event) => setGamesCount(Number(event.target.value.replace(/\D/g, "")) || 0)}
                  className="h-11 w-24 rounded-lg border border-border bg-surface px-3 text-sm tabular-nums"
                />
              </div>
              <p className="text-xs text-text-secondary">
                Limite de {generationConfig.maxGamesPerRequest} jogos por geração.
              </p>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="surface-card space-y-3 p-4">
              <Label>4. Dezenas fixas (opcional)</Label>
              <p className="text-xs text-text-secondary">
                Estas dezenas aparecem em todos os jogos criados.
              </p>
              <p className="text-xs text-text-secondary">
                Fixadas: {fixed.length} · Excluídas: {excluded.length} · Disponíveis:{" "}
                {availableCount}
              </p>
              <LotteryNumberGrid
                rules={rules}
                fixed={fixed}
                excluded={excluded}
                onSelect={toggleFixed}
              />
              {fixed.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setFixed([])}>
                  Limpar dezenas fixas
                </Button>
              ) : null}
            </section>

            <section className="surface-card space-y-3 p-4">
              <Label>5. Dezenas excluídas (opcional)</Label>
              <p className="text-xs text-text-secondary">
                Estas dezenas nunca aparecem nos jogos criados.
              </p>
              <p className="text-xs text-text-secondary">
                Fixadas: {fixed.length} · Excluídas: {excluded.length} · Disponíveis:{" "}
                {availableCount}
              </p>
              <LotteryNumberGrid
                rules={rules}
                fixed={fixed}
                excluded={excluded}
                onSelect={toggleExcluded}
              />
              {excluded.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setExcluded([])}>
                  Limpar dezenas excluídas
                </Button>
              ) : null}
            </section>
          </div>

          <section className="surface-card space-y-3 p-4">
            <Label>6. Concurso (opcional)</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["next", nextContest ? `Próximo concurso (${nextContest})` : "Próximo concurso"],
                  ["custom", "Outro concurso"],
                  ["none", "Sem concurso"],
                ] as [ContestChoice, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={contestChoice === value}
                  onClick={() => setContestChoice(value)}
                  className={cn(
                    "touch-target rounded-full px-4 text-sm font-medium",
                    contestChoice === value
                      ? "bg-lottery text-lottery-foreground"
                      : "bg-surface-secondary text-text-secondary",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {contestChoice === "custom" ? (
              <div className="space-y-1">
                <Label htmlFor="custom-contest">Número do concurso futuro</Label>
                <input
                  id="custom-contest"
                  inputMode="numeric"
                  value={customContest}
                  onChange={(event) => setCustomContest(event.target.value.replace(/\D/g, ""))}
                  placeholder={nextContest ? String(nextContest) : ""}
                  className="h-11 w-40 rounded-lg border border-border bg-surface px-3 text-sm tabular-nums"
                />
              </div>
            ) : null}
          </section>

          <section className="surface-card sticky bottom-20 z-10 space-y-3 p-4 sm:bottom-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-text-secondary">Valor por jogo</p>
                <p className="font-display text-lg font-semibold text-text-primary">
                  {priceQuery.isLoading ? "…" : formatCurrency(unitPrice)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Jogos</p>
                <p className="font-display text-lg font-semibold text-text-primary">
                  {formatNumber(gamesCount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Valor total estimado</p>
                <p className="font-display text-lg font-semibold text-text-primary">
                  {priceQuery.isLoading ? "…" : formatCurrency(totalPrice)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPriceHelp((value) => !value)}
              aria-expanded={showPriceHelp}
              className="text-xs font-medium text-text-secondary underline-offset-4 hover:underline"
            >
              Como o preço é calculado?
            </button>
            {showPriceHelp && combinationCount ? (
              <p className="text-xs text-text-secondary">
                Uma aposta com {numbersCount} dezenas equivale a {formatNumber(combinationCount)}{" "}
                combinações simples. O valor vem da tabela oficial de preços registrada no app.
              </p>
            ) : null}

            {!validation.ok ? (
              <ul className="space-y-1 rounded-lg bg-danger-soft p-3 text-xs text-danger">
                {validation.issues.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-secondary">
                {formatNumber(validation.possibilities)} jogos diferentes são possíveis com esta
                configuração.
              </p>
            )}

            <Button className="h-12 w-full" disabled={!validation.ok} onClick={handleGenerate}>
              Criar jogos
            </Button>
          </section>
        </>
      )}
    </div>
  );
}
