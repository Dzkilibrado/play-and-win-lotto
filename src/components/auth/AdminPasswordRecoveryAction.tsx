import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { sendAdminPasswordRecovery } from "@/lib/admin/users.functions";
import { hasLocalPassword, RECOVERY_WAIT_MESSAGE } from "@/lib/auth/recovery";

export function AdminPasswordRecoveryAction({ id, providers }: { id: string; providers: string[] }) {
  const [open, setOpen] = useState(false);
  const [nextRequestAt, setNextRequestAt] = useState(0);
  const mutation = useMutation({
    mutationFn: () => sendAdminPasswordRecovery({ data: { targetUserId: id } }),
    onSuccess: () => {
      setOpen(false); setNextRequestAt(Date.now() + 60_000);
      toast.success("Instruções de redefinição de senha enviadas.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível enviar as instruções."),
  });
  if (!hasLocalPassword(providers)) return null;
  return <>
    <Button variant="ghost" size="sm" className="h-auto min-h-9 max-w-full whitespace-normal text-left" onClick={() => {
      if (Date.now() < nextRequestAt) { toast.error(RECOVERY_WAIT_MESSAGE); return; }
      setOpen(true);
    }}><Mail aria-hidden className="shrink-0" />Enviar redefinição de senha</Button>
    <ConfirmDialog open={open} onOpenChange={setOpen} title="Enviar instruções de redefinição de senha para este usuário?"
      description="O usuário receberá um link seguro por e-mail e escolherá sua própria senha. O status de acesso não será alterado."
      confirmLabel="Enviar" loadingLabel="Enviando…" loading={mutation.isPending} onConfirm={() => mutation.mutate()} />
  </>;
}