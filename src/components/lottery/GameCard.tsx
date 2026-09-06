import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { NumberBall } from "@/components/lottery/NumberBall";
import { MetricCard } from "@/components/common/Cards";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { GameAnalysisResult } from "@/lib/engine/types";
import { gameStatusLabel, gameStatusTone, type GameStatus } from "@/types/domain";
import { cn } from "@/lib/utils";

export interface GameCardProps {
  title: string;
  numbers: number[];
  analysis: GameAnalysisResult;
  lotteryName?: string;
  colorKey?: string;
  contestNumber?: number | null;
  status?: GameStatus | null;
  cost?: number | null;
  createdAt?: string | null;
  to?: string;
  params?: Record<string, string>;
  actions?: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

function distributionText(distribution: Record<string, number>) {
  return Object.entries(distribution)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key}: ${count}`)
    .join(" · ");
}

/** Card único usado na geração, em Meus Jogos e futuramente em bolões. */
export function GameCard({
  title,
  numbers,
  analysis,
  lotteryName,
  colorKey,
  contestNumber,
  status,
  cost,
  createdAt,
  to,
  params,
  actions,
  defaultExpanded = false,
  className,
}: GameCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <article
      className={cn("surface-card space-y-3 p-4", className)}
      data-lottery={colorKey}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-text-primary">{title}</p>
          <p className="text-xs text-text-secondary">
            {[
              lotteryName,
              `${numbers.length} dezenas`,
              contestNumber ? `Concurso ${contestNumber}` : "Sem concurso",
              cost != null ? formatCurrency(cost) : null,
              createdAt ? new Date(createdAt).toLocaleDateString("pt-BR") : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {status ? (
          <StatusBadge label={gameStatusLabel[status]} tone={gameStatusTone[status]} />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {numbers.map((number) => (
          <NumberBall key={number} value={number} variant="lottery" size="sm" />
        ))}
      </div>

      <dl className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
        <MetricCard label="Par" value={analysis.evenCount} />
        <MetricCard label="Ímpar" value={analysis.oddCount} />
        <MetricCard label="Soma" value={analysis.sumTotal} />
        <MetricCard label="Primos" value={analysis.primeCount} />
        <MetricCard label="Fibonacci" value={analysis.fibonacciCount} />
        <MetricCard
          label="Repetidas"
          value={analysis.repeatedFromLast ?? "—"}
        />
      </dl>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex items-center gap-1 text-xs font-medium text-text-secondary"
      >
        <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        {expanded ? "Ocultar análise" : "Ver análise completa"}
      </button>

      {expanded ? (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <MetricCard label="Sequência máxima" value={analysis.maxSequence} />
          <MetricCard label="Maior salto" value={analysis.maxGap} />
          <MetricCard label="Linhas" value={distributionText(analysis.rowDistribution) || "—"} />
          <MetricCard label="Colunas" value={distributionText(analysis.columnDistribution) || "—"} />
          {analysis.comparedToContest ? (
            <MetricCard
              className="col-span-2"
              label="Repetidas"
              value={`Comparado ao concurso ${analysis.comparedToContest}`}
            />
          ) : null}
        </dl>
      ) : null}

      {(actions || to) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {actions}
          {to ? (
            <Link
              to={to}
              params={params ?? {}}
              className="text-xs font-medium text-lottery underline-offset-4 hover:underline"
            >
              Ver detalhe
            </Link>
          ) : null}
        </div>
      )}
    </article>
  );
}
