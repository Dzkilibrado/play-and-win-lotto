import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePoolPermanently } from "@/lib/pools/poolManagement.functions";
import { poolService, type PoolRow } from "@/lib/services/poolService";
import { userErrorMessage } from "@/lib/user-error";

export function PoolDeleteDialog({ pool, open, onOpenChange }: { pool: PoolRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [confirmation, setConfirmation] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const deleteFn = useServerFn(deletePoolPermanently);
  const summary = useQuery({
    queryKey: ["pool-delete-summary", pool.id],
    queryFn: () => poolService.deleteSummary(pool.id),
    enabled: open,
  });
  useEffect(() => { if (open) setConfirmation(""); }, [open]);

  const mutation = useMutation({
    mutationFn: () => deleteFn({ data: { poolId: pool.id, confirmation: "EXCLUIR" } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["pools"] });
      queryClient.removeQueries({ queryKey: ["pool", pool.id] });
      toast.success(result.cleanupPending ? "Bolão excluído; a limpeza dos arquivos será concluída automaticamente." : "Bolão excluído definitivamente");
      onOpenChange(false);
      navigate({ to: "/pools" });
    },
    onError: (error: Error) => toast.error(userErrorMessage(error)),
  });
  const counts = summary.data;

  return (
    <Dialog open={open} onOpenChange={(next) => mutation.isPending ? undefined : onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Excluir definitivamente este bolão?</DialogTitle>
          <DialogDescription>Esta ação apaga permanentemente o bolão e seus dados associados e não poderá ser desfeita. Os jogos salvos continuam na conta e apenas deixam de pertencer ao bolão.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-surface-secondary p-3 text-sm">
          <div><dt className="text-text-secondary">Participantes</dt><dd className="font-semibold">{counts?.participants ?? "—"}</dd></div>
          <div><dt className="text-text-secondary">Jogos</dt><dd className="font-semibold">{counts?.games ?? "—"}</dd></div>
          <div><dt className="text-text-secondary">Pagamentos</dt><dd className="font-semibold">{counts?.payments ?? "—"}</dd></div>
          <div><dt className="text-text-secondary">Comprovantes</dt><dd className="font-semibold">{counts?.documents ?? "—"}</dd></div>
        </dl>
        <div className="space-y-1.5">
          <Label htmlFor="delete-pool-confirmation">Digite EXCLUIR para confirmar</Label>
          <Input id="delete-pool-confirmation" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" className="h-11" disabled={confirmation !== "EXCLUIR" || mutation.isPending || summary.isLoading} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}