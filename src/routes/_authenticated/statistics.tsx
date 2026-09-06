import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { appConfig } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { validateListSearch } from "@/lib/searchFilters";

const sections = [
  "Mais sorteadas",
  "Menos sorteadas",
  "Mais atrasadas",
  "Pares e ímpares",
  "Números primos",
  "Sequência de Fibonacci",
  "Soma das dezenas",
  "Sequências",
  "Repetidas do concurso anterior",
  "Distribuição por linha e coluna",
];

const periods = [
  "Todo o histórico",
  "Últimos 10",
  "Últimos 20",
  "Últimos 50",
  "Últimos 100",
  "Último ano",
  "Período personalizado",
];

export const Route = createFileRoute("/_authenticated/statistics")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Estatísticas — ${appConfig.name}` },
      { name: "description", content: "Análises históricas dos concursos por modalidade." },
      { property: "og:title", content: `Estatísticas — ${appConfig.name}` },
      { property: "og:description", content: "Análises históricas dos concursos por modalidade." },
    ],
  }),
  component: StatisticsPage,
});

function StatisticsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Estatísticas"
        description="Análises sobre o histórico de sorteios de cada modalidade."
      />

      <div className="rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-text-primary">
        Estatísticas históricas não garantem nem aumentam a probabilidade de acerto. Cada sorteio é
        independente.
      </div>

      <div className="surface-card space-y-3 p-4">
        <p className="text-sm font-medium text-text-primary">Modalidades previstas</p>
        <p className="text-sm text-text-secondary">
          {activeLotteries.map((lottery) => lottery.name).join(" · ")}
        </p>
        <p className="text-sm font-medium text-text-primary">Períodos de análise previstos</p>
        <div className="flex flex-wrap gap-2">
          {periods.map((period) => (
            <span
              key={period}
              className="rounded-full bg-surface-secondary px-3 py-1 text-xs text-text-secondary"
            >
              {period}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => (
          <div key={section} className="surface-card p-4">
            <p className="font-display text-sm font-semibold text-text-primary">{section}</p>
            <p className="mt-1 text-xs text-text-secondary">
              Aguardando importação do histórico oficial.
            </p>
          </div>
        ))}
      </div>

      <NotImplementedNotice
        title="Cálculos estatísticos ainda não implementados"
        description="Nenhum número é apresentado antes da importação e validação do histórico."
      />
    </div>
  );
}
