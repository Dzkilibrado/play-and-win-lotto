import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { appConfig } from "@/config/app.config";
import { adminNav, secondaryNav } from "@/config/navigation";

export const Route = createFileRoute("/_authenticated/more")({
  head: () => ({
    meta: [
      { title: `Mais — ${appConfig.name}` },
      { name: "description", content: "Resultados, concursos, estatísticas, perfil e ajustes." },
      { property: "og:title", content: `Mais — ${appConfig.name}` },
      { property: "og:description", content: "Resultados, concursos, estatísticas e ajustes." },
    ],
  }),
  component: MorePage,
});

function MorePage() {
  const items = [...secondaryNav, ...adminNav];
  return (
    <div className="space-y-4">
      <PageHeader title="Mais" description="Demais áreas do aplicativo." />
      <ul className="surface-card divide-y divide-border">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex touch-target items-center gap-3 px-4 py-3 text-sm font-medium text-text-primary"
              >
                <Icon className="size-4 text-text-secondary" aria-hidden />
                {item.label}
                <ChevronRight className="ml-auto size-4 text-text-secondary" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
