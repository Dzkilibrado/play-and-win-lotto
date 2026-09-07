/**
 * Cadastro e edição de participante.
 * No cadastro é possível registrar o pagamento no mesmo passo — o banco grava
 * participante e pagamento numa única transação (`pool_add_participant`).
 * Na edição, os pagamentos já lançados são preservados; o valor devido é
 * recalculado pelo banco e o rateio passa a constar como desatualizado.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NumberStepper } from "@/components/common/NumberStepper";
import { PaymentMethodField, validatePaymentMethod } from "@/components/pool/PaymentMethodField";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentMethod } from "@/config/pools.config";
import { formatCurrency } from "@/lib/format";
import { poolService, type PoolParticipantRow, type PoolRow } from "@/lib/services/poolService";

type PaymentMode = "PENDING" | "FULL" | "PARTIAL";

const paymentModeLabel: Record<PaymentMode, string> = {
  PENDING: "Pendente",
  FULL: "Pago integralmente",
  PARTIAL: "Pagamento parcial",
};

export const adjustmentHelp =
  "Ajuste opcional sobre o valor das cotas. Use um valor positivo para acrescentar e um valor negativo para descontar.";

export function ParticipantFormDialog({
  pool,
  participant,
  open,
  onOpenChange,
  maxQuotas,
}: {
  pool: PoolRow;
  /** `null` = cadastro; preenchido = edição. */
  participant: PoolParticipantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cotas ainda livres (mais as do próprio participante, na edição). */
  maxQuotas: number | null;
}) {
  const queryClient = useQueryClient();
  const editing = participant !== null;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quotas, setQuotas] = useState(1);
  const [adjustment, setAdjustment] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("PENDING");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("PIX");
  const [methodDescription, setMethodDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(participant?.name ?? "");
    setPhone(participant?.phone ?? "");
    setQuotas(participant?.quotas ?? 1);
    setAdjustment(String(participant?.amount_adjustment ?? 0));
    setAdjustmentReason(participant?.adjustment_reason ?? "");
    setNotes(participant?.notes ?? "");
    setPaymentMode("PENDING");
    setPaymentAmount("");
    setMethod("PIX");
    setMethodDescription("");
  }, [open, participant]);

  const adjustmentValue = Number(adjustment.replace(",", "."));
  const adjustmentValid = Number.isFinite(adjustmentValue);
  const totalDue = Math.max(
    pool.quota_value * quotas + (adjustmentValid ? adjustmentValue : 0),
    0,
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pool-payments", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pools"] });
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (editing) {
        return poolService.updateParticipant(participant.id, {
          name: name.trim(),
          phone: phone.trim() || null,
          quotas,
          adjustment: adjustmentValue,
          adjustment_reason: adjustmentReason.trim() || null,
          notes: notes.trim() || null,
        });
      }
      return poolService.addParticipant({
        poolId: pool.id,
        name: name.trim(),
        phone: phone.trim() || null,
        quotas,
        adjustment: adjustmentValue,
        adjustmentReason: adjustmentReason.trim() || null,
        notes: notes.trim() || null,
        paymentMode,
        paymentAmount:
          paymentMode === "PARTIAL" ? Number(paymentAmount.replace(",", ".")) : null,
        method: paymentMode === "PENDING" ? null : method,
        methodDescription:
          paymentMode !== "PENDING" && method === "OTHER" ? methodDescription.trim() : null,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Participante atualizado" : "Participante adicionado");
      onOpenChange(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    if (!name.trim()) {
      toast.error("Informe o nome do participante.");
      return;
    }
    if (!adjustmentValid) {
      toast.error("O ajuste deve ser um valor numérico.");
      return;
    }
    if (adjustmentValue !== 0 && !adjustmentReason.trim()) {
      toast.error("Informe o motivo do ajuste de valor.");
      return;
    }
    if (!editing && paymentMode !== "PENDING") {
      const methodError = validatePaymentMethod(method, methodDescription);
      if (methodError) {
        toast.error(methodError);
        return;
      }
      if (paymentMode === "PARTIAL") {
        const value = Number(paymentAmount.replace(",", "."));
        if (!Number.isFinite(value) || value <= 0) {
          toast.error("Informe um valor pago maior que zero.");
          return;
        }
        if (value > totalDue) {
          toast.error("O valor parcial não pode ultrapassar o total devido.");
          return;
        }
      }
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar participante" : "Adicionar participante"}</DialogTitle>
          <DialogDescription>
            O valor devido é calculado automaticamente: cotas × {formatCurrency(pool.quota_value)}.
            {editing ? " Os pagamentos já registrados são preservados." : ""}
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
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="participant-phone">Telefone / WhatsApp (opcional)</Label>
            <Input
              id="participant-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-11"
              inputMode="tel"
            />
          </div>

          <NumberStepper
            id="participant-quotas"
            label="Cotas"
            value={quotas}
            onChange={setQuotas}
            min={1}
            max={maxQuotas ?? 999}
            hint={
              maxQuotas === null
                ? "Este bolão não tem limite de cotas."
                : `Até ${maxQuotas} cotas disponíveis.`
            }
          />

          <div className="space-y-1.5">
            <Label htmlFor="participant-adjustment">Ajuste no valor (opcional)</Label>
            <Input
              id="participant-adjustment"
              value={adjustment}
              onChange={(event) => setAdjustment(event.target.value)}
              className="h-11"
              inputMode="decimal"
              aria-describedby="participant-adjustment-help"
            />
            <p id="participant-adjustment-help" className="text-xs text-text-secondary">
              {adjustmentHelp}
            </p>
          </div>

          {adjustmentValue !== 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="participant-adjustment-reason">Motivo do ajuste</Label>
              <Input
                id="participant-adjustment-reason"
                value={adjustmentReason}
                onChange={(event) => setAdjustmentReason(event.target.value)}
                className="h-11"
              />
            </div>
          ) : null}

          <p className="rounded-lg bg-surface-secondary p-3 text-sm text-text-secondary">
            Total devido:{" "}
            <strong className="text-text-primary">{formatCurrency(totalDue)}</strong>
            {editing ? (
              <>
                {" "}
                · já pago{" "}
                <strong className="text-text-primary">
                  {formatCurrency(participant.total_paid)}
                </strong>
              </>
            ) : null}
          </p>

          {!editing ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="participant-payment-mode">Pagamento</Label>
                <Select
                  value={paymentMode}
                  onValueChange={(value) => setPaymentMode(value as PaymentMode)}
                >
                  <SelectTrigger id="participant-payment-mode" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(paymentModeLabel) as PaymentMode[]).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {paymentModeLabel[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {paymentMode === "PARTIAL" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="participant-payment-amount">Valor pago agora</Label>
                  <Input
                    id="participant-payment-amount"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    className="h-11"
                    inputMode="decimal"
                  />
                </div>
              ) : null}

              {paymentMode !== "PENDING" ? (
                <PaymentMethodField
                  idPrefix="participant"
                  method={method}
                  description={methodDescription}
                  onMethodChange={setMethod}
                  onDescriptionChange={setMethodDescription}
                />
              ) : null}
            </>
          ) : null}

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
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11">
            Cancelar
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} className="h-11">
            {editing ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
