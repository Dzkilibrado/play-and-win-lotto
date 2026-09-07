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

export interface GameCardCheck {
  hits: number;
  matchedNumbers: number[];
  isPrized: boolean;
  totalPrize: number | null;
  amountPending: boolean;
  prizeLabel: string | null;
}

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
  origin?: string | null;
  /** Resultado da conferência já gravado pelo servidor (quando existir). */
  check?: GameCardCheck | null;
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
  origin,
  check,
  to,
  params,
  actions,
  defaultExpanded = false,
  className,
}: GameCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const matched = new Set(check?.matchedNumbers ?? []);

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
              origin,
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

      {check ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs",
            check.isPrized ? "bg-success-soft text-success" : "bg-surface-secondary text-text-secondary",
          )}
        >
          <span className="font-medium">
            {check.hits} {check.hits === 1 ? "dezena acertada" : "dezenas acertadas"}
          </span>
          <span className="font-medium">
            {check.isPrized
              ? check.totalPrize == null
                ? `${check.prizeLabel ?? "Premiado"} · valor ainda não informado`
                : `${check.prizeLabel ?? "Premiado"} · ${formatCurrency(check.totalPrize)}`
              : "Sem premiação"}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {numbers.map((number) => (
          <NumberBall
            key={number}
            value={number}
            variant={check ? (matched.has(number) ? "hit" : "muted") : "lottery"}
            size="sm"
          />
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

      {/* Linha inteira expande/recolhe — a seta é só indicador. */}
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="tappable -mx-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs font-medium text-text-secondary hover:bg-surface-secondary"
      >
        <span>{expanded ? "Ocultar análise" : "Ver análise completa"}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
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
              aria-label={`Abrir detalhe de ${title}`}
              className="tappable inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 text-xs font-medium text-lottery hover:bg-surface-secondary"
            >
              Ver detalhe
            </Link>
          ) : null}
        </div>
      )}
    </article>
  );
}
