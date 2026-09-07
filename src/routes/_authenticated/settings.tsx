import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { HomePreferencesPanel } from "@/components/settings/HomePreferencesPanel";
import { appConfig, featureStatusLabel } from "@/config/app.config";
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
      {
        name: "description",
        content: "Tema, personalização da tela inicial e recursos do aplicativo.",
      },
      { property: "og:title", content: `Configurações — ${appConfig.name}` },
      { property: "og:description", content: "Tema, tela inicial e recursos." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const flags = useFeatureFlags();

  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" description="Comportamento e exibição do aplicativo." />

      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">Aparência</h2>
        <ThemeSelector variant="list" />
      </section>

      <section className="surface-card space-y-4 p-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-text-primary">Tela inicial</h2>
          <p className="text-xs text-text-secondary">
            Escolha os blocos, a ordem e as loterias que quer acompanhar.
          </p>
        </div>
        <HomePreferencesPanel />
      </section>

      <section className="surface-card p-0">
        <Link
          to="/lotteries"
          className="flex touch-target items-center gap-3 px-4 py-3 text-sm font-medium text-text-primary"
        >
          Ver todas as loterias
          <ChevronRight className="ml-auto size-4 text-text-secondary" aria-hidden />
        </Link>
      </section>

      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">Recursos</h2>
        <ul className="space-y-2">
          {Object.entries(flags.flags).map(([key, status]) => (
            <li key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-text-primary">{key}</span>
              <StatusBadge label={featureStatusLabel[status]} tone={toneByStatus[status]} />
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-text-secondary">{appConfig.support.responsibleGamingNotice}</p>
    </div>
  );
}
