import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/contests/$id")({
  head: () => ({
    meta: [
      { title: `Detalhe do concurso — ${appConfig.name}` },
      { name: "description", content: "Dezenas sorteadas, rateio e premiação do concurso." },
      { property: "og:title", content: `Detalhe do concurso — ${appConfig.name}` },
      { property: "og:description", content: "Dezenas sorteadas, rateio e premiação." },
    ],
  }),
  component: ContestDetailPage,
});

function ContestDetailPage() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-4">
      <PageHeader
        title={`Concurso ${id}`}
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/contests">Voltar</Link>
          </Button>
        }
      />
      <NotImplementedNotice
        title="Sem dados oficiais"
        description="As dezenas sorteadas e o rateio serão exibidos assim que a sincronização oficial for concluída."
      />
    </div>
  );
}
