import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";

/** Tela única exibida a quem não é administrador enquanto o sistema está em manutenção. */
export function MaintenanceScreen({
  reason,
  onRetry,
  onSignOut,
}: {
  reason: string | null;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="surface-card w-full max-w-md space-y-4 p-6 text-center" role="status">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Wrench className="size-7" aria-hidden />
        </span>
        <h1 className="font-display text-xl font-semibold text-text-primary">
          Estamos em manutenção
        </h1>
        <p className="text-sm text-text-secondary">
          {reason ?? "Estamos fazendo um ajuste no sistema."} Seus jogos e bolões estão guardados e
          seguros. Volte em alguns minutos.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="h-11" onClick={onRetry}>
            Tentar novamente
          </Button>
          <Button variant="outline" className="h-11" onClick={onSignOut}>
            Sair
          </Button>
        </div>
        <p className="text-xs text-text-secondary">{appConfig.name}</p>
      </div>
    </main>
  );
}
