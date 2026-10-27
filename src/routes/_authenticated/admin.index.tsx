import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  SlidersHorizontal,
  Ticket,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AdminMonitor } from "@/components/admin/AdminMonitor";
import { PageHeader } from "@/components/layout/PageHeader";
import { appConfig } from "@/config/app.config";
import { useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: `Administração — ${appConfig.name}` },
      { name: "description", content: "Área administrativa do aplicativo." },
      { property: "og:title", content: `Administração — ${appConfig.name}` },
      { property: "og:description", content: "Área administrativa do aplicativo." },
    ],
  }),
  component: AdminPage,
});

interface AdminCard {
  to:
    | "/admin/atualizacao"
    | "/admin/conferencia"
    | "/admin/loterias"
    | "/admin/users"
    | "/admin/recursos";
  title: string;
  description: string;
  icon: LucideIcon;
}

const cards: AdminCard[] = [
  {
    to: "/admin/atualizacao",
    title: "Atualização automática",
    description: "Resultados e próximo sorteio da fonte oficial.",
    icon: RefreshCw,
  },
  {
    to: "/admin/conferencia",
    title: "Conferência de jogos",
    description: "Fila, reprocessamento e erros.",
    icon: ClipboardCheck,
  },
  {
    to: "/admin/loterias",
    title: "Loterias",
    description: "Disponibilidade e clubes da Timemania.",
    icon: Ticket,
  },
  {
    to: "/admin/users",
    title: "Usuários",
    description: "Contas, acessos e perfis cadastrados.",
    icon: Users,
  },
  {
    to: "/admin/recursos",
    title: "Controle do sistema",
    description: "Modo manutenção geral e ações de urgência.",
    icon: SlidersHorizontal,
  },
];

function AdminPage() {
  const { user } = useSession();

  return (
    <div className="space-y-5">
      <PageHeader title="Administração" description="Acompanhe o sistema e abra cada função." />
      <AdminMonitor userId={user.id} />
      <section aria-labelledby="admin-functions" className="space-y-2">
        <h2 id="admin-functions" className="font-display text-base font-semibold text-text-primary">
          Funções
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ to, title, description, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="surface-card tappable flex min-h-20 items-center gap-3 p-4 hover:border-primary"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-sm font-semibold text-text-primary">
                    {title}
                  </span>
                  <span className="block text-xs text-text-secondary">{description}</span>
                </span>
                <ChevronRight className="ml-auto size-5 shrink-0 text-text-secondary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
