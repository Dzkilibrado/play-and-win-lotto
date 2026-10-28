import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { backTargetFor } from "@/lib/navigation/backTarget";

/** "Voltar" presente em todas as telas internas, para o usuário nunca se sentir preso. */
export function BackBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const target = backTargetFor(pathname);
  if (!target) return null;

  return (
    <nav aria-label="Voltar" className="-mt-1 mb-2">
      <Link
        to={target.to}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg pr-3 text-sm font-medium text-primary"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Voltar
        <span className="sr-only"> para {target.label}</span>
      </Link>
    </nav>
  );
}
