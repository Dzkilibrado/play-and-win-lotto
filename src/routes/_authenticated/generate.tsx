import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { GameCard } from "@/components/lottery/GameCard";
import { GenerationFilters } from "@/components/lottery/GenerationFilters";
import { SmartWeights, describeWeightSelection } from "@/components/lottery/SmartWeights";
import { NumberSelectionCard } from "@/components/lottery/NumberSelectionCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { generationConfig } from "@/config/generation.config";
import { activeLotteries, type LotterySlug } from "@/config/lotteries";
import { useSession } from "@/hooks/useAuth";
import { useHomePreferences } from "@/hooks/useHomePreferences";
import { useGameGeneration } from "@/lib/engine/useGameGeneration";
import {
  activeFilterIds,
  buildConstraintsSnapshot,
  defaultFilterStates,
  validateFilters,
  type FilterContext,
  type FilterId,
  type FilterStates,
} from "@/lib/engine/filters";
import { universeNumbers } from "@/lib/engine/rules";
import { allowedNumbersCounts, resolveRules } from "@/lib/engine/rules";
import { validateGenerationRequest } from "@/lib/engine/validator";
import {
  buildStrategySnapshot,
  computeWeights,
  defaultWeightSelection,
  validateWeightSelection,
} from "@/lib/engine/weights";
import { statisticsService } from "@/lib/services/statisticsService";
import {
  buildStatisticsQuery,
  resolveReferenceContest,
} from "@/lib/services/statisticsReference";

import type { GeneratedGameDraft, GenerationMetrics } from "@/lib/engine/types";
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
  const [filters, setFilters] = useState<FilterStates>(() => defaultFilterStates());
  const [games, setGames] = useState<GeneratedGameDraft[] | null>(null);
  const [metrics, setMetrics] = useState<GenerationMetrics | null>(null);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showPriceHelp, setShowPriceHelp] = useState(false);
  const [weightSelection, setWeightSelection] = useState(() => defaultWeightSelection());
  const { generating, generate, cancel } = useGameGeneration();

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

  const [pendingLottery, setPendingLottery] = useState<LotterySlug | null>(null);

  const changeLottery = (next: LotterySlug) => {
    const nextRules = resolveRules(next)!;
    setSlug(next);
    setNumbersCount(nextRules.selectable.base);
    setFixed([]);
    setExcluded([]);
    setFilters(defaultFilterStates());
    setWeightSelection(defaultWeightSelection());
    setGames(null);
    setMetrics(null);
    setSavedKeys([]);
    void navigate({ search: (prev) => ({ ...prev, lottery: next }) });
  };

  /** Opções que seriam perdidas ao trocar de modalidade. */
  const hasOptionalConfig =
    fixed.length > 0 ||
    excluded.length > 0 ||
    activeFilterIds(filters).length > 0 ||
    weightSelection.strategyId !== "none";

  const requestLotteryChange = (next: LotterySlug) => {
    if (next === slug) return;
    if (!hasOptionalConfig) {
      changeLottery(next);
      return;
    }
    setPendingLottery(next);
  };

  /**
   * Sem modalidade na URL, a tela abre na favorita do usuário.
   * Acontece uma única vez: trocar de modalidade continua livre.
   */
  const preferences = useHomePreferences();
  const favoriteApplied = useRef(false);
  useEffect(() => {
    if (favoriteApplied.current) return;
    if (search.lottery) {
      favoriteApplied.current = true;
      return;
    }
    if (preferences.loading) return;
    favoriteApplied.current = true;
    if (preferences.favoriteSlug && preferences.favoriteSlug !== slug) {
      changeLottery(preferences.favoriteSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.loading, preferences.favoriteSlug]);

  const universeSize = rules.universe.max - rules.universe.min + 1;
  const availableCount = universeSize - fixed.length - excluded.length;

  const unitPrice = priceQuery.data?.price ?? null;
  const totalPrice = unitPrice != null ? unitPrice * gamesCount : null;
  const combinationCount = priceQuery.data?.combination_count ?? null;

  const contestNumber = resolveReferenceContest(contestChoice, nextContest, customContest);


  /**
   * Referência do filtro "Repetidas do concurso anterior".
   * Com um concurso escolhido, o anterior é o imediatamente anterior a ele —
   * não simplesmente o último sorteio disponível.
   */
  const repeatedReference = filters.repeated.config.reference;
  const referenceBefore =
    repeatedReference === "latest-draw" ? null : (contestNumber ?? null);

  const previousDrawQuery = useQuery({
    queryKey: ["previous-draw", slug, referenceBefore],
    queryFn: () => lotteryDataService.getPreviousDraw(slug, referenceBefore),
  });

  const previousDraw = useMemo(() => {
    const row = previousDrawQuery.data;
    if (!row) return null;
    return {
      contestNumber: row.contestNumber,
      numbers: row.numbers,
      origin: repeatedReference,
    };
  }, [previousDrawQuery.data, repeatedReference]);

  const previousDrawLabel = previousDrawQuery.isLoading
    ? "Buscando o concurso de referência…"
    : previousDraw
      ? `A comparação usa o concurso ${previousDraw.contestNumber}${
          referenceBefore ? ` (anterior ao concurso ${referenceBefore})` : " (último já sorteado)"
        }.`
      : "Ainda não temos um concurso anterior registrado para esta comparação.";

  const pool = useMemo(
    () =>
      universeNumbers(rules).filter(
        (value) => !excluded.includes(value) && !fixed.includes(value),
      ),
    [rules, excluded, fixed],
  );

  const filterContext: FilterContext = useMemo(
    () => ({ rules, numbersCount, fixed, pool, excluded, previousDraw }),
    [rules, numbersCount, fixed, pool, excluded, previousDraw],
  );

  /**
   * Estatísticas por dezena (agregadas no banco).
   *
   * A referência temporal nunca inclui o concurso do jogo nem posteriores:
   * quando há concurso escolhido, só entram concursos anteriores a ele.
   */
  const weightsActive = weightSelection.strategyId !== "none";
  const weightSelectionIssues = validateWeightSelection(weightSelection);
  const statisticsQuery = useQuery({
    enabled: weightsActive && weightSelectionIssues.length === 0,
    queryKey: ["number-statistics", slug, weightSelection.window, contestNumber],
    queryFn: () =>
      statisticsService.getNumberStatistics(
        buildStatisticsQuery({
          lotterySlug: slug,
          window: weightSelection.window,
          contestNumber,
        }),
      ),

  });
  const statisticsSnapshot = statisticsQuery.data ?? null;

  const weights = useMemo(() => {
    if (!weightsActive || !statisticsSnapshot || weightSelectionIssues.length > 0) return null;
    return computeWeights(weightSelection, statisticsSnapshot, pool);
  }, [weightsActive, statisticsSnapshot, weightSelection, weightSelectionIssues.length, pool]);

  /** Vetor compacto enviado ao motor: apenas dezena e peso. */
  const weightVector = useMemo(() => {
    if (!weights || !statisticsSnapshot) return null;
    return {
      strategyId: weightSelection.strategyId,
      intensity: weightSelection.intensity,
      window: weightSelection.window,
      contestsAnalyzed: statisticsSnapshot.contestsAnalyzed,
      lastContestConsidered: statisticsSnapshot.lastContestConsidered,
      numbers: weights.map((item) => item.number),
      values: weights.map((item) => item.finalWeight),
    };
  }, [weights, statisticsSnapshot, weightSelection]);

  const request = useMemo(
    () => ({
      lotterySlug: slug,
      numbersCount,
      gamesCount,
      fixed,
      excluded,
      filters,
      previousDraw,
      weights: weightVector,
    }),
    [slug, numbersCount, gamesCount, fixed, excluded, filters, previousDraw, weightVector],
  );
  const validation = useMemo(() => validateGenerationRequest(request), [request]);

  const issuesByFilter = useMemo(() => {
    const map: Partial<Record<FilterId, string[]>> = {};
    for (const issue of validateFilters(filters, filterContext)) {
      map[issue.filterId] = [...(map[issue.filterId] ?? []), issue.message];
    }
    return map;
  }, [filters, filterContext]);

  const activeFilterCount = activeFilterIds(filters).length;

  /**
   * Cada problema aparece uma única vez, junto da opção que o originou.
   * O resumo só recebe os problemas que não têm quadro próprio.
   */
  const pendingTargets = useMemo(() => {
    const targets: { id: string; label: string }[] = [];
    if (validation.issues.some((issue) => issue.code === "TOO_MANY_FIXED")) {
      targets.push({ id: "fixos-card", label: "Números fixos" });
    }
    if (validation.issues.some((issue) => issue.code === "FILTER")) {
      targets.push({ id: "filtros-card", label: "Filtros" });
    }
    return targets;
  }, [validation.issues]);

  const summaryIssues = validation.issues.filter(
    (issue) => issue.code !== "TOO_MANY_FIXED" && issue.code !== "FILTER",
  );

  const focusCard = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleGenerate = async () => {
    if (generating) return;
    try {
      const outcome = await generate(request, {
        lastDrawNumbers: lastNumbers,
        lastContestNumber: lastDraw?.contest_number ?? null,
      });
      if (!outcome) return;
      if (!outcome.validation.ok) {
        toast.error(outcome.validation.issues[0]?.message ?? "Configuração inválida.");
        return;
      }
      setGames(outcome.games);
      setMetrics(outcome.metrics);
      setSavedKeys([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar os jogos.");
    }
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
          constraints: buildConstraintsSnapshot(filters),
          strategy:
            weights && statisticsSnapshot
              ? buildStrategySnapshot(weightSelection, statisticsSnapshot, weights)
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
            <Button disabled={generating} onClick={() => void handleGenerate()}>
              {generating ? "Gerando jogos…" : "Criar novamente"}
            </Button>
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
              {games.length} {games.length === 1 ? "jogo" : "jogos"} ·{" "}
              {formatCurrency(unitPrice != null ? unitPrice * games.length : null)}
              {contestNumber ? ` · concurso ${contestNumber}` : " · sem concurso"}
            </span>
          </div>

          {metrics ? (
            <div
              className={cn(
                "rounded-xl p-3 text-sm",
                metrics.generated < metrics.requested ? "bg-warning-soft text-warning" : "bg-surface-secondary text-text-secondary",
              )}
            >
              {metrics.generated < metrics.requested ? (
                <div className="space-y-2">
                  <p>
                    Com os filtros escolhidos foi possível criar {metrics.generated} de{" "}
                    {metrics.requested} jogos.
                    {metrics.stopReason === "time_limit"
                      ? " A busca foi encerrada para não travar o aparelho."
                      : metrics.stopReason === "space_exhausted"
                        ? " Não existem mais combinações diferentes que atendam aos filtros."
                        : " Poucas combinações atendem a todos os filtros ao mesmo tempo."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setGames(null)}>
                      Ajustar filtros
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generating}
                      onClick={() => void handleGenerate()}
                    >
                      {generating ? "Gerando jogos…" : "Tentar novamente"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p>
                  {metrics.generated} {metrics.generated === 1 ? "jogo criado" : "jogos criados"}
                  {metrics.activeFilters > 0
                    ? ` com ${metrics.activeFilters} ${metrics.activeFilters === 1 ? "filtro aplicado" : "filtros aplicados"}`
                    : " sem filtros"}
                  {metrics.weights ? ` · ${describeWeightSelection(weightSelection)}` : ""}.
                </p>
              )}
            </div>
          ) : null}

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
                    onClick={() => requestLotteryChange(item.slug)}
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
            <div id="fixos-card" className="scroll-mt-24">
            <NumberSelectionCard
              label="4. Fixar números (opcional)"
              drawerTitle="Fixar números"
              description="Escolha dezenas que deverão estar em todos os jogos."
              drawerDescription="Selecione as dezenas que devem aparecer em todos os jogos. Dezenas já excluídas ficam bloqueadas."
              value={fixed}
              onChange={(next) => {
                setFixed(next);
                setGames(null);
              }}
              rules={rules}
              locked={excluded}
              excludedMarks={excluded}
              limit={numbersCount}
              notice={(openDrawer) =>
                fixed.length > numbersCount ? (
                  <div className="space-y-2 rounded-lg bg-warning-soft p-3">
                    <p className="text-xs text-warning">
                      Você possui {fixed.length} números fixos, mas o jogo foi configurado para{" "}
                      {numbersCount} dezenas.
                    </p>
                    <Button variant="outline" size="sm" className="h-9" onClick={openDrawer}>
                      Editar números fixos
                    </Button>
                  </div>
                ) : null
              }
            />
            </div>

            <NumberSelectionCard
              label="5. Excluir números (opcional)"
              drawerTitle="Excluir números"
              description="Escolha dezenas que não poderão aparecer nos jogos."
              drawerDescription="Selecione as dezenas que não devem aparecer nos jogos. Dezenas fixas não aparecem aqui."
              value={excluded}
              onChange={(next) => {
                setExcluded(next);
                setGames(null);
              }}
              rules={rules}
              hidden={fixed}
              notice={
                <p className="text-xs text-text-secondary">
                  Disponíveis para sorteio: {availableCount} de {universeSize} dezenas.
                </p>
              }
            />
          </div>


          <div id="filtros-card" className="scroll-mt-24">
          <GenerationFilters
            states={filters}
            onChange={(next) => {
              setFilters(next);
              setGames(null);
              setMetrics(null);
            }}
            context={filterContext}
            issuesByFilter={issuesByFilter}
            previousDrawLabel={previousDrawLabel}
          />
          </div>

          <section className="surface-card space-y-3 p-4">
            <Label>7. Concurso (opcional)</Label>
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

          <SmartWeights
            selection={weightSelection}
            onChange={(next) => {
              setWeightSelection(next);
              setGames(null);
              setMetrics(null);
            }}
            weights={weights}
            snapshot={statisticsSnapshot}
            loading={statisticsQuery.isLoading}
            error={statisticsQuery.isError}
            colorKey={rules.colorKey}
          />

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

            <p className="text-xs text-text-secondary [overflow-wrap:anywhere]">
              {gamesCount} {gamesCount === 1 ? "jogo" : "jogos"} · {numbersCount} dezenas ·{" "}
              {fixed.length} {fixed.length === 1 ? "fixa" : "fixas"} · {excluded.length}{" "}
              {excluded.length === 1 ? "excluída" : "excluídas"} · {activeFilterCount}{" "}
              {activeFilterCount === 1 ? "filtro" : "filtros"} ·{" "}
              {describeWeightSelection(weightSelection)}
            </p>



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
              <div className="space-y-2 rounded-lg bg-danger-soft p-3 text-xs text-danger">
                {summaryIssues.length ? (
                  <ul className="space-y-1">
                    {summaryIssues.map((issue, index) => (
                      <li key={`${issue.code}-${index}`}>{issue.message}</li>
                    ))}
                  </ul>
                ) : null}
                {pendingTargets.length ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Configuração precisa de ajuste:</span>
                    {pendingTargets.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => focusCard(target.id)}
                        className="rounded-full bg-surface px-3 py-1 font-medium text-danger underline-offset-4 hover:underline"
                      >
                        {target.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-text-secondary">
                {formatNumber(validation.possibilities)} jogos diferentes são possíveis com esta
                configuração
                {activeFilterCount > 0
                  ? ` — os filtros escolhidos reduzem esse total.`
                  : "."}
              </p>
            )}

            <Button
              className="h-12 w-full"
              disabled={!validation.ok || generating}
              onClick={() => void handleGenerate()}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Gerando jogos…
                </span>
              ) : (
                "Criar jogos"
              )}
            </Button>
            {generating ? (
              <div className="space-y-2 text-center" role="status" aria-live="polite">
                <p className="text-xs text-text-secondary">
                  Procurando jogos que atendem à sua configuração. Você pode continuar usando o app.
                </p>
                <Button variant="ghost" size="sm" onClick={cancel}>
                  Cancelar
                </Button>
              </div>
            ) : null}
          </section>
        </>
      )}

      <ConfirmDialog
        open={pendingLottery !== null}
        onOpenChange={(next) => (next ? undefined : setPendingLottery(null))}
        title="Trocar modalidade?"
        description="Você possui opções de geração configuradas. Ao trocar de modalidade, números fixos, números excluídos, filtros e pesos serão limpos."
        cancelLabel="Continuar nesta modalidade"
        confirmLabel="Trocar e limpar"
        onConfirm={() => {
          const next = pendingLottery;
          setPendingLottery(null);
          if (next) changeLottery(next);
        }}
      />
    </div>
  );
}
