import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { poolNotices } from "@/config/pools.config";
import { formatCurrency } from "@/lib/format";
import { poolService, type PoolParticipantRow } from "@/lib/services/poolService";

export function PaymentDialog({
  poolId,
  participant,
  onClose,
}: {
  poolId: string;
  participant: PoolParticipantRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [confirmOverpay, setConfirmOverpay] = useState(false);

  const falta = participant
    ? Math.max(Number(participant.amount_due) - Number(participant.total_paid), 0)
    : 0;

  useEffect(() => {
    if (participant) {
      setAmount(falta > 0 ? String(falta) : "");
      setConfirmOverpay(false);
      setMethod("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant?.id]);

  const mutation = useMutation({
    mutationFn: (allowOverpay: boolean) =>
      poolService.registerPayment({
        participantId: participant!.id,
        amount: Number(amount),
        paidAt: new Date(`${paidAt}T12:00:00`).toISOString(),
        method: method.trim() || null,
        notes: notes.trim() || null,
        allowOverpay,
      }),
    onSuccess: () => {
      toast.success("Pagamento registrado");
      void queryClient.invalidateQueries({ queryKey: ["pool", poolId] });
      void queryClient.invalidateQueries({ queryKey: ["pool-payments", poolId] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
      onClose();
    },
    onError: (error: Error) => {
      if (error.message.includes("acima do devido")) {
        setConfirmOverpay(true);
        toast.warning(poolNotices.overpay);
        return;
      }
      toast.error(error.message);
    },
  });

  const submit = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    mutation.mutate(confirmOverpay);
  };

  return (
    <Dialog open={participant !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {participant
              ? `${participant.name} — ${formatCurrency(participant.total_paid)} pagos de ${formatCurrency(participant.amount_due)}${falta > 0 ? `, faltam ${formatCurrency(falta)}` : ""}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">Valor</Label>
              <Input
                id="payment-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-date">Data</Label>
              <Input
                id="payment-date"
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Forma (opcional)</Label>
              <Input
                id="payment-method"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="h-11"
                placeholder="Pix, dinheiro…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-notes">Observação</Label>
              <Input
                id="payment-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="h-11"
              />
            </div>
          </div>
          {confirmOverpay ? (
            <p className="rounded-lg bg-warning-soft p-3 text-xs text-warning">{poolNotices.overpay}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={submit} disabled={mutation.isPending}>
            {confirmOverpay ? "Registrar mesmo assim" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
