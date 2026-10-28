import { createFileRoute, redirect } from "@tanstack/react-router";

import { LotteryAvailabilityPanel } from "@/components/admin/LotteryAvailabilityPanel";
import { LotteryClubsPanel } from "@/components/admin/LotteryClubsPanel";
import { AdminSection } from "@/components/admin/AdminSection";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/admin/loterias")({
  beforeLoad: ({ context }) => {
    if (!context.isAdmin) throw redirect({ to: "/dashboard", replace: true });
  },
  head: () => ({
    meta: [
      { title: `Loterias — ${appConfig.name}` },
      {
        name: "description",
        content: "Disponibilidade de cada modalidade e cadastro dos clubes da Timemania.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminSection
      title="Loterias"
      description="Quais modalidades os usuários podem usar e os clubes da Timemania."
    >
      <LotteryAvailabilityPanel />
      <LotteryClubsPanel />
    </AdminSection>
  );
}
