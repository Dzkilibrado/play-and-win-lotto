import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { LotteryTicket } from "@/components/lottery/NumberBall";
import { StatusBadge } from "@/components/common/StatusBadge";
import { appConfig } from "@/config/app.config";
import { activeLotteries, getLotteryConfig, type LotterySlug } from "@/config/lotteries";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { featureStatusLabel } from "@/config/app.config";
import { validateListSearch } from "@/lib/searchFilters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/generate")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Gerar jogo — ${appConfig.name}` },
      { name: "description", content: "Escolha a modalidade e monte seus jogos." },
      { property: "og:title", content: `Gerar jogo — ${appConfig.name}` },
      { property: "og:description", content: "Escolha a modalidade e monte seus jogos." },
    ],
  }),
  component: GeneratePage,
});

function GeneratePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const flags = useFeatureFlags();

  const slug = (search.lottery as LotterySlug | undefined) ?? activeLotteries[0]!.slug;
  const lottery = getLotteryConfig(slug) ?? activeLotteries[0]!;
  const flag = flags.data?.generator;

  return (
    <div className="space-y-4" data-lottery={lottery.colorKey}>
      <PageHeader
        title="Gerar jogo"
        description="A modalidade define universo, quantidade de dezenas e faixas de premiação."
        actions={
          flag ? <StatusBadge label={featureStatusLabel[flag]} tone="warning" /> : undefined
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Modalidade">
        {activeLotteries.map((item) => (
          <button
            key={item.slug}
            type="button"
            role="tab"
            aria-selected={item.slug === lottery.slug}
            data-lottery={item.colorKey}
            onClick={() => navigate({ search: (prev) => ({ ...prev, lottery: item.slug }) })}
            className={cn(
              "touch-target rounded-full px-4 text-sm font-medium transition-colors",
              item.slug === lottery.slug
                ? "bg-lottery text-lottery-foreground"
                : "bg-surface-secondary text-text-secondary",
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <section className="surface-card space-y-4 p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-text-secondary">Universo</dt>
            <dd className="font-display font-semibold text-text-primary">
              {lottery.universe.min} a {lottery.universe.max}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Dezenas por jogo</dt>
            <dd className="font-display font-semibold text-text-primary">
              {lottery.selectable.min} a {lottery.selectable.max}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Aposta simples</dt>
            <dd className="font-display font-semibold text-text-primary">
              {lottery.selectable.base} dezenas
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Faixas premiadas</dt>
            <dd className="font-display font-semibold text-text-primary">
              {lottery.prizeTiers.map((tier) => tier.hits).join(", ")}
            </dd>
          </div>
        </dl>

        <LotteryTicket
          min={lottery.universe.min}
          max={lottery.universe.max}
          columns={lottery.grid.columns}
        />
      </section>

      <NotImplementedNotice
        title="Motor de geração ainda não implementado"
        description="O volante acima mostra apenas o universo da modalidade. Os algoritmos de geração, filtros matemáticos e pesos serão construídos na próxima fase."
      />
    </div>
  );
}
