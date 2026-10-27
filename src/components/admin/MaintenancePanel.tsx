import { useMutation } from "@tanstack/react-query";
import { Power } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/common/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { supabase } from "@/integrations/supabase/client";

/** Motivos prontos: escolher é mais rápido e evita erro de digitação em uma urgência. */
const maintenanceReasons = [
  "Estamos fazendo uma manutenção programada.",
  "Estamos corrigindo um problema com urgência.",
  "Estamos atualizando os dados oficiais dos concursos.",
  "Estamos melhorando o sistema.",
] as const;

export function MaintenancePanel() {
  const { status, refresh } = useSystemStatus();
  const [reason, setReason] = useState<string>(maintenanceReasons[0]);

  const change = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc(
        "admin_set_maintenance" as never,
        {
          _enabled: enabled,
          _reason: enabled ? reason : null,
        } as never,
      );
      if (error) throw error;
      return enabled;
    },
    onSuccess: async (enabled) => {
      toast.success(enabled ? "Modo manutenção ligado." : "Modo manutenção desligado.");
      await refresh();
    },
    onError: () => toast.error("Não foi possível alterar. Tente novamente."),
  });

  const on = status.maintenance;

  return (
    <section
      aria-labelledby="maintenance-title"
      className="surface-card space-y-4 p-4"
      data-testid="maintenance-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="maintenance-title"
            className="font-display text-base font-semibold text-text-primary"
          >
            Modo manutenção geral
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Use em caso de urgência. Ligado, ninguém além dos administradores consegue usar o
            sistema nem criar jogos ou bolões. Nada que já existe é apagado.
          </p>
        </div>
        <StatusBadge label={on ? "Ligado" : "Desligado"} tone={on ? "warning" : "success"} />
      </div>

      {on ? (
        <div className="space-y-3">
          {status.reason ? (
            <p className="rounded-lg bg-surface-secondary p-3 text-sm text-text-primary">
              Mensagem exibida: {status.reason}
            </p>
          ) : null}
          <Button
            className="h-12 w-full sm:w-auto"
            disabled={change.isPending}
            onClick={() => change.mutate(false)}
          >
            <Power className="size-4" aria-hidden />
            {change.isPending ? "Desligando…" : "Desligar manutenção e liberar o sistema"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="maintenance-reason">Mensagem para os usuários</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="maintenance-reason" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {maintenanceReasons.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="h-12 w-full sm:w-auto"
                disabled={change.isPending}
              >
                <Power className="size-4" aria-hidden />
                Ligar modo manutenção
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Colocar o sistema em manutenção?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os usuários, menos administradores, verão a tela de manutenção e não poderão
                  criar jogos nem bolões até você desligar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => change.mutate(true)}>
                  Ligar agora
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  );
}
