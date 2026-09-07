/**
 * Rota antiga de Resultados.
 *
 * A experiência foi unificada em "Concursos e Resultados"; aqui só
 * preservamos os links existentes com um redirecionamento permanente,
 * mantendo os filtros que já estavam na URL.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

import { validateListSearch } from "@/lib/searchFilters";

export const Route = createFileRoute("/_authenticated/results")({
  validateSearch: validateListSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/contests", search, replace: true });
  },
  component: () => null,
});
