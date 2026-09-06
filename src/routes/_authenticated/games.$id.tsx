import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/games/$id")({
  head: () => ({
    meta: [
      { title: `Detalhe do jogo — ${appConfig.name}` },
      { name: "description", content: "Dezenas, análise e situação de um jogo." },
      { property: "og:title", content: `Detalhe do jogo — ${appConfig.name}` },
      { property: "og:description", content: "Dezenas, análise e situação de um jogo." },
    ],
  }),
  component: GameDetailPage,
});

function GameDetailPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-4">
      <PageHeader
        title="Detalhe do jogo"
        description={`Identificador ${id}`}
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/games">Voltar</Link>
          </Button>
        }
      />
      <NotImplementedNotice
        title="Tela em preparação"
        description="Aqui aparecerão as dezenas, a análise do jogo, o concurso vinculado e o resultado da conferência."
      />
    </div>
  );
}
