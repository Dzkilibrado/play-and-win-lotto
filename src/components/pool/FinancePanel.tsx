import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MetricCard } from "@/components/common/Cards";
import { ReasonDialog } from "@/components/common/ReasonDialog";
import { EmptyState } from "@/components/common/StateViews";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { summarizeFinance } from "@/lib/pools/poolMath";
import { poolService, type PoolParticipantRow, type PoolRow } from "@/lib/services/poolService";

export function FinancePanel({
  pool,
  participants,
  canManage,
}: {
  pool: PoolRow;
  participants: PoolParticipantRow[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();

  const payments = useQuery({
    queryKey: ["pool-payments", pool.id],
    queryFn: () => poolService.payments(pool.id),
  });

  const [correcting, setCorrecting] = useState<
    { id: string; name: string; amount: number; paidAt: string | null } | null
  >(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => poolService.cancelPayment(id, reason),
    onSuccess: () => {
      toast.success("Pagamento corrigido");
      setCorrecting(null);
      setCorrectionError(null);
      void queryClient.invalidateQueries({ queryKey: ["pool-payments", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
    },
    onError: (error: Error) => setCorrectionError(error.message),
  });

  const summary = summarizeFinance(
    participants.map((p) => ({
      quotas: p.quotas,
      amountDue: Number(p.amount_due),
      totalPaid: Number(p.total_paid),
      paymentStatus: p.payment_status,
      cancelled: p.status === "CANCELLED",
    })),
  );

  const rows = (payments.data ?? []).filter((row) => row.cancelled_at === null);
  const nameOf = (participantId: string) =>
    participants.find((p) => p.id === participantId)?.name ?? "Participante";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total previsto" value={formatCurrency(summary.totalDue)} />
        <MetricCard label="Recebido" value={formatCurrency(summary.totalPaid)} />
        <MetricCard label="Em aberto" value={formatCurrency(summary.totalOutstanding)} />
        <MetricCard
          label="Pagamentos em atraso"
          value={`${summary.overdue}`}
        />
      </div>

      <div className="surface-card p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">Situação por participante</h2>
        <ul className="mt-2 divide-y divide-border">
          {participants
            .filter((p) => p.status === "ACTIVE")
            .map((participant) => {
              const falta = Math.max(Number(participant.amount_due) - Number(participant.total_paid), 0);
              return (
                <li key={participant.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate text-text-primary">{participant.name}</span>
                  <span className="shrink-0 text-text-secondary">
                    {formatCurrency(participant.total_paid)} de {formatCurrency(participant.amount_due)}
                    {falta > 0 ? ` · faltam ${formatCurrency(falta)}` : ""}
                  </span>
                </li>
              );
            })}
        </ul>
      </div>

      <div className="surface-card p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">Pagamentos registrados</h2>
        {rows.length === 0 ? (
          <EmptyState
            className="mt-3 border-0 bg-transparent p-0 shadow-none"
            icon={Wallet}
            title="Nenhum pagamento registrado ainda"
            description="Os pagamentos aparecem aqui assim que forem lançados na aba de participantes."
          />
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {rows.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-text-primary">{nameOf(payment.participant_id)}</p>
                  <p className="text-xs text-text-secondary">
                    {formatDate(payment.paid_at)}
                    {payment.method
                      ? ` · ${describePaymentMethod(payment.method as PaymentMethod, payment.method_description)}`
                      : ""}

                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{formatCurrency(Number(payment.amount))}</span>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCorrectionError(null);
                        setCorrecting({
                          id: payment.id,
                          name: nameOf(payment.participant_id),
                          amount: Number(payment.amount),
                          paidAt: payment.paid_at,
                        });
                      }}
                    >
                      <Undo2 className="size-4" aria-hidden />
                      Corrigir
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ReasonDialog
        open={correcting !== null}
        onOpenChange={(next) => (!next ? setCorrecting(null) : undefined)}
        title="Corrigir pagamento"
        description="O pagamento deixa de contar no total recebido e a situação do participante é recalculada. O histórico guarda o registro da correção."
        fieldLabel="Motivo da correção"
        placeholder="Ex.: valor lançado em duplicidade."
        confirmLabel="Corrigir pagamento"
        cancelLabel="Voltar"
        destructive
        loading={cancelMutation.isPending}
        error={correctionError}
        details={
          correcting ? (
            <div className="rounded-lg bg-surface-secondary p-3 text-sm text-text-secondary">
              <p className="text-text-primary">{correcting.name}</p>
              <p>
                {formatCurrency(correcting.amount)}
                {correcting.paidAt ? ` · ${formatDate(correcting.paidAt)}` : ""}
              </p>
            </div>
          ) : null
        }
        onConfirm={(reason) =>
          correcting ? cancelMutation.mutate({ id: correcting.id, reason }) : undefined
        }
      />
    </div>
  );
}
