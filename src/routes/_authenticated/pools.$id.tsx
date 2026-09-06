import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, NotImplementedNotice } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appConfig } from "@/config/app.config";
import { validateListSearch } from "@/lib/searchFilters";

const tabs = [
  { value: "overview", label: "Visão Geral" },
  { value: "participants", label: "Participantes" },
  { value: "games", label: "Jogos" },
  { value: "finance", label: "Financeiro" },
  { value: "result", label: "Resultado" },
  { value: "documents", label: "Documentos" },
  { value: "history", label: "Histórico" },
];

export const Route = createFileRoute("/_authenticated/pools/$id")({
  validateSearch: validateListSearch,
  head: () => ({
    meta: [
      { title: `Detalhe do bolão — ${appConfig.name}` },
      { name: "description", content: "Participantes, cotas, pagamentos e documentos do bolão." },
      { property: "og:title", content: `Detalhe do bolão — ${appConfig.name}` },
      { property: "og:description", content: "Participantes, cotas, pagamentos e documentos." },
    ],
  }),
  component: PoolDetailPage,
});

function PoolDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Detalhe do bolão"
        description={`Identificador ${id}`}
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/pools">Voltar</Link>
          </Button>
        }
      />

      <Tabs defaultValue={search.tab ?? "overview"}>
        <div className="-mx-4 overflow-x-auto px-4">
          <TabsList className="w-max">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            <NotImplementedNotice
              title={`${tab.label} em preparação`}
              description="A estrutura no banco já existe; a interface será ligada na próxima fase."
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
