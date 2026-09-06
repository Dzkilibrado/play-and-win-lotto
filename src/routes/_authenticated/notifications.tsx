import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { EmptyState } from "@/components/common/StateViews";
import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: `Notificações — ${appConfig.name}` },
      { name: "description", content: "Avisos de sorteios, prazos e conferências." },
      { property: "og:title", content: `Notificações — ${appConfig.name}` },
      { property: "og:description", content: "Avisos de sorteios, prazos e conferências." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Notificações" description="Avisos sobre sorteios, prazos e bolões." />
      <EmptyState
        icon={Bell}
        title="Nenhuma notificação"
        description="Você ainda não tem avisos registrados."
      />
      <NotImplementedNotice
        title="Envio de notificações desativado"
        description="A tabela já existe no banco. O envio automático e as notificações push virão em fase futura."
      />
    </div>
  );
}
