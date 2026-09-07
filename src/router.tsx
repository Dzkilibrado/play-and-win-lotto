import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Dados recém-buscados continuam válidos por 1 minuto: voltar para uma
         * tela já visitada mostra o conteúdo na hora, sem tela de carregamento.
         */
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    /** Pré-carrega a próxima tela no toque/hover, antes mesmo do clique. */
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 30 * 1000,
  });

  return router;
};
