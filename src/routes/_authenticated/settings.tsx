import { createFileRoute } from "@tanstack/react-router";

import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { appConfig, featureStatusLabel } from "@/config/app.config";
import { activeLotteries } from "@/config/lotteries";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const toneByStatus = {
  ACTIVE: "success",
  BETA: "info",
  MAINTENANCE: "warning",
  DISABLED: "neutral",
} as const;

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: `Configurações — ${appConfig.name}` },
      { name: "description", content: "Tema, modalidades ativas e recursos do aplicativo." },
      { property: "og:title", content: `Configurações — ${appConfig.name}` },
      { property: "og:description", content: "Tema, modalidades ativas e recursos." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const flags = useFeatureFlags();

  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" description="Preferências de exibição e recursos." />

      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">Tema</h2>
        <ThemeSelector variant="list" />
      </section>

      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">Modalidades ativas</h2>
        <ul className="space-y-2">
          {activeLotteries.map((lottery) => (
            <li
              key={lottery.slug}
              data-lottery={lottery.colorKey}
              className="flex items-center gap-2 text-sm"
            >
              <span className="size-2.5 rounded-full bg-lottery" aria-hidden />
              <span className="text-text-primary">{lottery.name}</span>
              <span className="ml-auto text-xs text-text-secondary">
                {lottery.universe.min}–{lottery.universe.max}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">Recursos</h2>
        <ul className="space-y-2">
          {Object.entries(flags.flags).map(([key, status]) => (
            <li key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-text-primary">{key}</span>
              <StatusBadge label={featureStatusLabel[status]} tone={toneByStatus[status]} />
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-text-secondary">{appConfig.support.responsibleGamingNotice}</p>
    </div>
  );
}
