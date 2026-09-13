import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { HomePreferencesPanel } from "@/components/settings/HomePreferencesPanel";
import { appConfig } from "@/config/app.config";

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

      <p className="text-xs text-text-secondary">{appConfig.support.responsibleGamingNotice}</p>
    </div>
  );
}
