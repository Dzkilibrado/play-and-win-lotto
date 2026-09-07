import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorState, LoadingState } from "@/components/common/StateViews";
import { PageHeader } from "@/components/layout/PageHeader";
import { NumberBall } from "@/components/lottery/NumberBall";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { appConfig } from "@/config/app.config";
import { activeLotteries, getLotteryConfig, type LotteryConfig } from "@/config/lotteries";
import { formatDate } from "@/lib/format";
import { validateListSearch, type ListSearch } from "@/lib/searchFilters";
import {
  getCombinationStats,
  statisticsService,
  type CombinationStats,
} from "@/lib/services/statisticsService";
import {
  analyzedContests,
  formatPercentage,
  leastDrawn,
  mostDelayed,
  mostDrawn,
  statisticsWindows,
  toNumberRows,
  validateCombination,
  windowLabel,
  windowOf,
  type NumberRow,
} from "@/lib/statistics/statisticsView";
import { formatNumbersLabel, serializeNumbers } from "@/lib/contests/contestSearch";

const tabs = [
  { id: "overview", label: "Visão geral" },
  { id: "number", label: "Explorar dezena" },
  { id: "combination", label: "Combinação" },
] as const;

export const Route = createFileRoute("/_authenticated/statistics")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Estatísticas — ${appConfig.name}` },
      {
        name: "description",
        content: "Frequência, atraso e combinações no histórico oficial de cada modalidade.",
      },
      { property: "og:title", content: `Estatísticas — ${appConfig.name}` },
      {
        property: "og:description",
        content: "Frequência, atraso e combinações no histórico oficial de cada modalidade.",
      },
    ],
  }),
  component: StatisticsPage,
});

function StatisticsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (patch: Partial<ListSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const tab = tabs.find((item) => item.id === search.tab)?.id ?? "overview";
  const slug = search.lottery ?? activeLotteries[0]!.slug;
  const config = getLotteryConfig(slug)!;
  const window = windowOf(search.status);

  const snapshot = useQuery({
    queryKey: ["statistics", slug, window.value],
    queryFn: () =>
      statisticsService.getNumberStatistics({
        lotterySlug: slug,
        window: window.value,
        maxContest: null,
      }),
  });

  const rows = snapshot.data ? toNumberRows(snapshot.data) : [];
  const analyzed = snapshot.data ? analyzedContests(snapshot.data) : 0;

  return (
    <div className="space-y-4" data-lottery={config.colorKey}>
      <PageHeader
        title="Estatísticas"
        description="Histórico oficial das dezenas de cada modalidade."
      />

      <p className="rounded-xl border border-border bg-surface-secondary p-3 text-xs text-text-secondary">
        Os sorteios são independentes. Estatísticas históricas não aumentam a probabilidade de uma
        dezena ser sorteada.
      </p>

      <section className="surface-card space-y-3 p-3 sm:p-4" aria-label="Recorte">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="stat-lottery">Modalidade</Label>
            <select
              id="stat-lottery"
              className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
              value={slug}
              onChange={(event) => setSearch({ lottery: event.target.value, numbers: undefined })}
            >
              {activeLotteries.map((lottery) => (
                <option key={lottery.slug} value={lottery.slug}>
                  {lottery.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="stat-window">Período</Label>
            <select
              id="stat-window"
              className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
              value={window.id}
              onChange={(event) => setSearch({ status: event.target.value })}
            >
              {statisticsWindows.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          {windowLabel(window.id)} · {analyzed} concursos analisados
        </p>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Consultas">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setSearch({ tab: item.id })}
            className={
              tab === item.id
                ? "tappable rounded-full bg-lottery px-4 py-2 text-sm font-medium text-lottery-foreground"
                : "tappable rounded-full bg-surface-secondary px-4 py-2 text-sm font-medium text-text-secondary"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {snapshot.isLoading ? (
        <LoadingState rows={4} />
      ) : snapshot.isError ? (
        <ErrorState onRetry={() => snapshot.refetch()} />
      ) : tab === "overview" ? (
        <OverviewTab rows={rows} slug={slug} windowId={window.id} />
      ) : tab === "number" ? (
        <NumberTab rows={rows} config={config} windowValue={window.value} windowId={window.id} />
      ) : (
        <CombinationTab config={config} windowValue={window.value} windowId={window.id} />
      )}
    </div>
  );
}

function RankingList({
  rows,
  metric,
  slug,
  windowId,
}: {
  rows: NumberRow[];
  metric: "occurrences" | "delay";
  slug: string;
  windowId: string;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.number}>
          <Link
            to="/contests"
            search={{ lottery: slug, numbers: String(row.number) }}
            className="tappable grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2"
            aria-label={`Ver concursos da dezena ${row.number}`}
          >
            <NumberBall value={row.number} variant="lottery" size="sm" />
            <span className="min-w-0 truncate text-xs text-text-secondary">
              {metric === "occurrences"
                ? `${row.occurrences} ocorrências · ${formatPercentage(row.percentage)}`
                : `${row.drawsSince} concursos sem aparecer`}
            </span>
            <span className="text-xs font-medium text-lottery">Ver concursos</span>
          </Link>
        </li>
      ))}
      {rows.length === 0 ? (
        <li className="text-xs text-text-secondary">Sem dados para este recorte.</li>
      ) : null}
      <li className="sr-only">{windowId}</li>
    </ul>
  );
}

function OverviewTab({
  rows,
  slug,
  windowId,
}: {
  rows: NumberRow[];
  slug: string;
  windowId: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const blocks = [
    { id: "most", title: "Mais sorteados", data: mostDrawn(rows), metric: "occurrences" as const },
    { id: "least", title: "Menos sorteados", data: leastDrawn(rows), metric: "occurrences" as const },
    { id: "delay", title: "Maior atraso atual", data: mostDelayed(rows), metric: "delay" as const },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {blocks.map((block) => {
        const open = expanded === block.id;
        return (
          <section key={block.id} className="surface-card space-y-3 p-4">
            <h2 className="font-display text-sm font-semibold text-text-primary">{block.title}</h2>
            <RankingList
              rows={open ? block.data : block.data.slice(0, 5)}
              metric={block.metric}
              slug={slug}
              windowId={windowId}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 w-full"
              onClick={() => setExpanded(open ? null : block.id)}
            >
              {open ? "Mostrar apenas o top 5" : "Ver ranking completo"}
            </Button>
          </section>
        );
      })}
    </div>
  );
}

function NumberTab({
  rows,
  config,
  windowValue,
  windowId,
}: {
  rows: NumberRow[];
  config: LotteryConfig;
  windowValue: number | null;
  windowId: string;
}) {
  const [value, setValue] = useState("");
  const [applied, setApplied] = useState<number | null>(null);
  const parsed = Number(value);
  const validation = validateCombination(config, value === "" ? [] : [parsed]);

  const detail = useQuery({
    queryKey: ["statistics-number", config.slug, applied, windowValue],
    enabled: applied != null,
    queryFn: () => getCombinationStats(config.slug, [applied!], windowValue),
  });

  const row = rows.find((item) => item.number === applied);

  return (
    <div className="space-y-3">
      <section className="surface-card space-y-3 p-4">
        <div className="space-y-1">
          <Label htmlFor="stat-number">Dezena</Label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              id="stat-number"
              inputMode="numeric"
              value={value}
              placeholder={`${config.universe.min} a ${config.universe.max}`}
              onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
              className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm"
            />
            <Button
              type="button"
              className="h-11"
              disabled={!validation.ok}
              onClick={() => setApplied(parsed)}
            >
              Consultar
            </Button>
          </div>
          {value !== "" && !validation.ok ? (
            <p className="text-xs text-danger">{validation.error}</p>
          ) : null}
        </div>
      </section>

      {applied == null ? null : detail.isLoading ? (
        <LoadingState rows={2} />
      ) : detail.isError ? (
        <ErrorState onRetry={() => detail.refetch()} />
      ) : (
        <ResultPanel
          title={`Dezena ${String(applied).padStart(2, "0")}`}
          slug={config.slug}
          numbers={[applied]}
          stats={detail.data!}
          windowId={windowId}
          extra={
            row
              ? [
                  { label: "Ocorrências", value: `${row.occurrences}` },
                  { label: "Percentual dos concursos", value: formatPercentage(row.percentage) },
                  { label: "Concursos sem aparecer", value: `${row.drawsSince}` },
                ]
              : []
          }
        />
      )}
    </div>
  );
}

function CombinationTab({
  config,
  windowValue,
  windowId,
}: {
  config: LotteryConfig;
  windowValue: number | null;
  windowId: string;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [applied, setApplied] = useState<number[] | null>(null);
  const validation = validateCombination(config, selected);

  const detail = useQuery({
    queryKey: ["statistics-combination", config.slug, applied, windowValue],
    enabled: applied != null && applied.length > 0,
    queryFn: () => getCombinationStats(config.slug, applied!, windowValue),
  });

  const universe = Array.from(
    { length: config.universe.max - config.universe.min + 1 },
    (_, index) => config.universe.min + index,
  );

  const toggle = (value: number) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value].sort((a, b) => a - b),
    );

  return (
    <div className="space-y-3">
      <section className="surface-card space-y-3 p-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Combinação de dezenas
          </h2>
          <p className="text-xs text-text-secondary">
            A ordem não importa. Mostramos em quantos concursos essas dezenas apareceram juntas.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {universe.map((value) => {
            const active = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(value)}
                className={
                  active
                    ? "tappable size-11 rounded-full bg-lottery text-sm font-semibold text-lottery-foreground"
                    : "tappable size-11 rounded-full bg-surface-secondary text-sm font-medium text-text-primary"
                }
              >
                {String(value).padStart(2, "0")}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && !validation.ok ? (
          <p className="text-xs text-danger">{validation.error}</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="h-11"
            disabled={!validation.ok}
            onClick={() => setApplied([...selected])}
          >
            Consultar combinação
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => {
              setSelected([]);
              setApplied(null);
            }}
          >
            Limpar seleção
          </Button>
        </div>
      </section>

      {applied == null ? null : detail.isLoading ? (
        <LoadingState rows={2} />
      ) : detail.isError ? (
        <ErrorState onRetry={() => detail.refetch()} />
      ) : (
        <ResultPanel
          title={`Combinação: ${formatNumbersLabel(applied)}`}
          slug={config.slug}
          numbers={applied}
          stats={detail.data!}
          windowId={windowId}
          extra={[]}
        />
      )}
    </div>
  );
}

function ResultPanel({
  title,
  slug,
  numbers,
  stats,
  extra,
  windowId,
}: {
  title: string;
  slug: string;
  numbers: number[];
  stats: CombinationStats;
  extra: { label: string; value: string }[];
  windowId: string;
}) {
  const last = stats.draws[0];
  return (
    <section className="surface-card space-y-3 p-4">
      <h2 className="font-display text-sm font-semibold text-text-primary">{title}</h2>
      <p className="text-xs text-text-secondary">
        Recorte: {windowLabel(windowId)} · {stats.contestsAnalyzed} concursos
      </p>

      {stats.occurrences === 0 ? (
        <p className="text-sm text-text-primary">
          {numbers.length > 1
            ? "Essa combinação nunca apareceu completa no histórico consultado."
            : "Essa dezena não apareceu no histórico consultado."}
        </p>
      ) : (
        <>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Metric
              label="Ocorrências"
              value={`${stats.occurrences} ${stats.occurrences === 1 ? "concurso" : "concursos"}`}
            />
            {last ? (
              <Metric
                label="Última ocorrência"
                value={`Concurso ${last.contestNumber} · ${formatDate(last.drawDate)}`}
              />
            ) : null}
            {extra.map((item) => (
              <Metric key={item.label} label={item.label} value={item.value} />
            ))}
          </dl>

          <div>
            <p className="text-xs font-medium text-text-secondary">Concursos recentes</p>
            <ul className="mt-2 space-y-1">
              {stats.draws.map((draw) => (
                <li key={draw.id}>
                  <Link
                    to="/contests/$id"
                    params={{ id: draw.id }}
                    className="tappable flex items-center justify-between gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-xs"
                  >
                    <span className="text-text-primary">Concurso {draw.contestNumber}</span>
                    <span className="text-text-secondary">{formatDate(draw.drawDate)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <Button asChild variant="outline" size="sm" className="h-11 w-full">
        <Link
          to="/contests"
          search={{ lottery: slug, ...(serializeNumbers(numbers) ? { numbers: serializeNumbers(numbers)! } : {}) }}
        >
          Ver concursos
        </Link>
      </Button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-secondary px-3 py-2">
      <dt className="text-xs text-text-secondary">{label}</dt>
      <dd className="text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}
