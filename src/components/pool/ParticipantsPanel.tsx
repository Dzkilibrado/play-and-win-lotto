import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Plus, UserMinus, UserPlus, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
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
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { poolService, type PoolParticipantRow, type PoolRow } from "@/lib/services/poolService";
import { remainingQuotas } from "@/lib/pools/poolMath";
import { paymentStatusLabel, paymentStatusTone } from "@/types/domain";

interface Props {
  pool: PoolRow;
  participants: PoolParticipantRow[];
  canManage: boolean;
  onPay: (participant: PoolParticipantRow) => void;
}

const editableStatuses = ["FORMING", "OPEN", "CLOSED"];

export function ParticipantsPanel({ pool, participants, canManage, onPay }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quotas, setQuotas] = useState("1");
  const [adjustment, setAdjustment] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [notes, setNotes] = useState("");

  const active = participants.filter((p) => p.status === "ACTIVE");
  const quotasTaken = active.reduce((sum, p) => sum + p.quotas, 0);
  const livres = remainingQuotas(pool.total_quotas, quotasTaken);
  const semLimite = livres === null;
  const openForChanges = editableStatuses.includes(pool.status) && canManage;


  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pools"] });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      poolService.addParticipant({
        poolId: pool.id,
        name: name.trim(),
        phone: phone.trim() || null,
        quotas: Number(quotas),
        adjustment: Number(adjustment) || 0,
        adjustmentReason: adjustmentReason.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Participante adicionado");
      setOpen(false);
      setName("");
      setPhone("");
      setQuotas("1");
      setAdjustment("0");
      setAdjustmentReason("");
      setNotes("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      poolService.cancelParticipant(id, reason),
    onSuccess: () => {
      toast.success("Participante cancelado");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const eligibilityMutation = useMutation({
    mutationFn: ({ id, eligible, reason }: { id: string; eligible: boolean; reason?: string }) =>
      poolService.setEligibility(id, eligible, reason),
    onSuccess: () => {
      toast.success("Participação no rateio atualizada");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    const parsedQuotas = Number(quotas);
    if (!name.trim()) {
      toast.error("Informe o nome do participante.");
      return;
    }
    if (!Number.isInteger(parsedQuotas) || parsedQuotas < 1) {
      toast.error("A quantidade de cotas deve ser um número inteiro maior que zero.");
      return;
    }
    if (livres !== null && parsedQuotas > livres) {
      toast.error(`Restam apenas ${livres} cotas neste bolão.`);
      return;
    }

    if (Number(adjustment) !== 0 && !adjustmentReason.trim()) {
      toast.error("Informe o motivo do ajuste de valor.");
      return;
    }
    addMutation.mutate();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          {active.length} {active.length === 1 ? "participante ativo" : "participantes ativos"} ·{" "}
          {quotasTaken}/{pool.total_quotas} cotas · {livres} livres
        </p>
        {openForChanges ? (
          <Button size="sm" className="h-11" onClick={() => setOpen(true)} disabled={livres <= 0}>
            <UserPlus className="size-4" aria-hidden />
            Adicionar participante
          </Button>
        ) : null}
      </div>

      {participants.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nenhum participante neste bolão ainda"
          description="Adicione as pessoas e a quantidade de cotas de cada uma para acompanhar os pagamentos."
          actions={
            openForChanges ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Adicionar participante
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {participants.map((participant) => {
            const cancelled = participant.status === "CANCELLED";
            return (
              <li
                key={participant.id}
                className="surface-card space-y-2 p-3"
                data-cancelled={cancelled ? "true" : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-primary">
                      {participant.name}
                      {cancelled ? " (cancelado)" : ""}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {participant.quotas} {participant.quotas === 1 ? "cota" : "cotas"} ·{" "}
                      {formatCurrency(participant.amount_due)} devidos ·{" "}
                      {formatCurrency(participant.total_paid)} pagos
                    </p>
                    {participant.phone ? (
                      <p className="text-xs text-text-secondary">{participant.phone}</p>
                    ) : null}
                    {!participant.eligible_for_prize_share && participant.ineligible_reason ? (
                      <p className="mt-1 text-xs text-warning">
                        Fora do rateio: {participant.ineligible_reason}
                      </p>
                    ) : null}
                    {participant.adjustment_reason ? (
                      <p className="mt-1 text-xs text-text-secondary">
                        Ajuste: {formatCurrency(participant.amount_adjustment)} —{" "}
                        {participant.adjustment_reason}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge
                    label={paymentStatusLabel[participant.payment_status]}
                    tone={paymentStatusTone[participant.payment_status]}
                  />
                </div>

                {canManage && !cancelled ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onPay(participant)}>
                      <Wallet className="size-4" aria-hidden />
                      Registrar pagamento
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (participant.eligible_for_prize_share) {
                          const reason = window.prompt(
                            "Por que este participante fica fora do rateio?",
                          );
                          if (!reason?.trim()) return;
                          eligibilityMutation.mutate({
                            id: participant.id,
                            eligible: false,
                            reason: reason.trim(),
                          });
                        } else {
                          eligibilityMutation.mutate({ id: participant.id, eligible: true });
                        }
                      }}
                    >
                      <UserMinus className="size-4" aria-hidden />
                      {participant.eligible_for_prize_share ? "Tirar do rateio" : "Voltar ao rateio"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => {
                        const reason = window.prompt("Motivo do cancelamento deste participante:");
                        if (!reason?.trim()) return;
                        cancelMutation.mutate({ id: participant.id, reason: reason.trim() });
                      }}
                    >
                      <Ban className="size-4" aria-hidden />
                      Cancelar
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar participante</DialogTitle>
            <DialogDescription>
              O valor devido é calculado automaticamente: cotas × {formatCurrency(pool.quota_value)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="participant-name">Nome</Label>
              <Input
                id="participant-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="participant-phone">Telefone (opcional)</Label>
                <Input
                  id="participant-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="h-11"
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="participant-quotas">Cotas</Label>
                <Input
                  id="participant-quotas"
                  value={quotas}
                  onChange={(event) => setQuotas(event.target.value)}
                  className="h-11"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="participant-adjustment">Ajuste no valor (opcional)</Label>
                <Input
                  id="participant-adjustment"
                  value={adjustment}
                  onChange={(event) => setAdjustment(event.target.value)}
                  className="h-11"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="participant-adjustment-reason">Motivo do ajuste</Label>
                <Input
                  id="participant-adjustment-reason"
                  value={adjustmentReason}
                  onChange={(event) => setAdjustmentReason(event.target.value)}
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="participant-notes">Observações</Label>
              <Textarea
                id="participant-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="h-11">
              Cancelar
            </Button>
            <Button onClick={submit} disabled={addMutation.isPending} className="h-11">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
