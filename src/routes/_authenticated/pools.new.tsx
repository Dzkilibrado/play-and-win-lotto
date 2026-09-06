import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";

export const Route = createFileRoute("/_authenticated/pools/new")({
  head: () => ({
    meta: [
      { title: `Novo bolão — ${appConfig.name}` },
      { name: "description", content: "Criação de bolão com cotas e prazo de pagamento." },
      { property: "og:title", content: `Novo bolão — ${appConfig.name}` },
      { property: "og:description", content: "Criação de bolão com cotas e prazo de pagamento." },
    ],
  }),
  component: NewPoolPage,
});

function NewPoolPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Novo bolão"
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/pools">Voltar</Link>
          </Button>
        }
      />
      <NotImplementedNotice
        title="Formulário em preparação"
        description="Vai reunir modalidade, concurso, nome, valor da cota, total de cotas e prazo de pagamento."
      />
    </div>
  );
}
