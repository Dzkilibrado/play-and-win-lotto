import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownAZ, ArrowDownUp, Ban, Pencil, Plus, UserMinus, UserPlus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ReasonDialog } from "@/components/common/ReasonDialog";
import { EmptyState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/common/SearchInput";
import { ParticipantFormDialog } from "@/components/pool/ParticipantFormDialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { poolService, type PoolParticipantRow, type PoolRow } from "@/lib/services/poolService";
import { noQuotaLimitLabel, quotaLabel, remainingQuotas } from "@/lib/pools/poolMath";
import {
  countPaymentStatuses,
  filterAndSortParticipants,
  paymentFilters,
  type ParticipantSort,
  type PaymentFilter,
} from "@/lib/pools/participantList";
import { paymentStatusLabel, paymentStatusTone, type PaymentStatus } from "@/types/domain";
import { userErrorMessage } from "@/lib/user-error";

interface Props {
  pool: PoolRow;
  participants: PoolParticipantRow[];
  canManage: boolean;
  onPay: (participant: PoolParticipantRow) => void;
}

const editableStatuses = ["FORMING", "OPEN", "CLOSED"];
function quotaText(value: number) {
  return `${value} ${value === 1 ? "cota" : "cotas"}`;
}

function paymentLabel(status: PaymentStatus) {
  return status === "PAID" ? "✓ Pago" : paymentStatusLabel[status];
}

export function ParticipantsPanel({ pool, participants, canManage, onPay }: Props) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PoolParticipantRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PoolParticipantRow | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [eligibilityTarget, setEligibilityTarget] = useState<PoolParticipantRow | null>(null);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [sort, setSort] = useState<ParticipantSort>("NAME");

  const active = participants.filter((p) => p.status === "ACTIVE");
  const quotasTaken = active.reduce((sum, p) => sum + p.quotas, 0);
  const livres = remainingQuotas(pool.total_quotas, quotasTaken);
  const semLimite = livres === null;
  const openForChanges = editableStatuses.includes(pool.status) && canManage;
  const paymentCounts = useMemo(() => countPaymentStatuses(participants), [participants]);
  const visibleParticipants = useMemo(
    () => filterAndSortParticipants(participants, query, paymentFilter, sort),
    [participants, paymentFilter, query, sort],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pools"] });
  };

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      poolService.cancelParticipant(id, reason),
    onSuccess: () => {
      toast.success("Participante cancelado");
      setCancelTarget(null);
      setCancelError(null);
      invalidate();
    },
    onError: (error: Error) => setCancelError(userErrorMessage(error)),
  });

  const eligibilityMutation = useMutation({
    mutationFn: ({ id, eligible, reason }: { id: string; eligible: boolean; reason?: string }) =>
      poolService.setEligibility(id, eligible, reason),
    onSuccess: () => {
      toast.success("Participação no rateio atualizada");
      setEligibilityTarget(null);
      setEligibilityError(null);
      invalidate();
    },
    onError: (error: Error) => {
      if (eligibilityTarget) setEligibilityError(userErrorMessage(error));
      else toast.error(userErrorMessage(error));
    },
  });

  /** Na edição, o próprio participante já ocupa cotas: elas voltam ao limite. */
  const maxQuotasFor = (target: PoolParticipantRow | null) =>
    livres === null ? null : livres + (target?.quotas ?? 0);

  const openAdd = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (participant: PoolParticipantRow) => {
    setEditTarget(participant);
    setFormOpen(true);
  };


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          {active.length} {active.length === 1 ? "participante ativo" : "participantes ativos"} ·{" "}
          {semLimite
            ? `${quotasTaken} ${quotasTaken === 1 ? "cota atribuída" : "cotas atribuídas"} · ${noQuotaLimitLabel}`
            : `${quotaLabel(pool.total_quotas, quotasTaken)} cotas · ${livres} livres`}
        </p>
        {openForChanges ? (
          <Button
            size="sm"
            className="h-11"
            onClick={openAdd}

            disabled={livres !== null && livres <= 0}
          >
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
              <Button size="sm" onClick={openAdd}>
                <Plus className="size-4" aria-hidden />
                Adicionar participante
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="surface-card space-y-3 p-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar participante" ariaLabel="Buscar participante" />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por pagamento">
              {paymentFilters.map((status) => {
                const count = status === "ALL" ? participants.length : paymentCounts[status];
                const selected = paymentFilter === status;
                return (
                  <Button key={status} type="button" variant={selected ? "secondary" : "outline"} size="sm" className="h-9" aria-pressed={selected} onClick={() => setPaymentFilter(status)}>
                    {status === "ALL" ? "Todos" : paymentStatusLabel[status]} <span className="tabular-nums text-text-secondary">{count}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {visibleParticipants.length === 0 ? (
            <div className="surface-card px-4 py-6 text-center text-sm text-text-secondary">
              Nenhum participante encontrado com esses filtros.
            </div>
          ) : null}

          <div className="min-w-0 rounded-md border border-border bg-surface">
            <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_5.25rem] items-center gap-x-2 border-b border-border bg-surface-secondary px-2 py-2 text-[0.6875rem] font-semibold uppercase text-text-secondary sm:hidden">
              <span>Participante</span><span>Cotas</span><span>Status</span>
            </div>
            <ul className="divide-y divide-border sm:hidden" aria-label="Lista de participantes">
          {visibleParticipants.map((participant) => {
            const cancelled = participant.status === "CANCELLED";
            return (
              <li
                key={participant.id}
                className="min-w-0 space-y-2 p-2.5"
                data-cancelled={cancelled ? "true" : undefined}
              >
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_3.5rem_5.25rem] items-center gap-x-2">
                  <div className="min-w-0" title={participant.name}>
                    <p className="truncate text-sm font-medium text-text-primary">
                      {participant.name}
                      {cancelled ? " (cancelado)" : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs tabular-nums text-text-secondary">{quotaText(participant.quotas)}</span>
                  <StatusBadge label={paymentLabel(participant.payment_status)} tone={paymentStatusTone[participant.payment_status]} className="justify-self-start whitespace-nowrap px-2" />
                </div>
                <div className="min-w-0 space-y-1 border-t border-border pt-2 text-xs text-text-secondary">
                  <p>{formatCurrency(participant.amount_due)} devidos · {formatCurrency(participant.total_paid)} pagos</p>
                  {participant.phone ? <p>{participant.phone}</p> : null}
                  {!participant.eligible_for_prize_share && participant.ineligible_reason ? <p className="text-warning">Fora do rateio: {participant.ineligible_reason}</p> : null}
                  {participant.adjustment_reason ? <p>Ajuste: {formatCurrency(participant.amount_adjustment)} — {participant.adjustment_reason}</p> : null}
                </div>
                {canManage && !cancelled ? <ParticipantActions participant={participant} openForChanges={openForChanges} pending={eligibilityMutation.isPending} onPay={onPay} onEdit={openEdit} onEligibility={() => { if (participant.eligible_for_prize_share) { setEligibilityError(null); setEligibilityTarget(participant); } else eligibilityMutation.mutate({ id: participant.id, eligible: true }); }} onCancel={() => { setCancelError(null); setCancelTarget(participant); }} /> : null}
              </li>
            );
          })}
            </ul>

            <table className="hidden w-full table-fixed text-sm sm:table">
              <caption className="sr-only">Lista administrativa de participantes</caption>
              <colgroup><col /><col className="w-28" /><col className="w-36" /></colgroup>
              <thead className="bg-surface-secondary text-left text-xs font-semibold uppercase text-text-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2"><SortButton active={sort === "NAME"} onClick={() => setSort("NAME")} label="Participante" /></th>
                  <th scope="col" className="px-3 py-2"><SortButton active={sort === "QUOTAS"} onClick={() => setSort("QUOTAS")} label="Cotas" /></th>
                  <th scope="col" className="px-3 py-2"><SortButton active={sort === "PAYMENT"} onClick={() => setSort("PAYMENT")} label="Pagamento" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleParticipants.map((participant) => {
                  const cancelled = participant.status === "CANCELLED";
                  return <tr key={participant.id} data-cancelled={cancelled ? "true" : undefined}>
                    <td className="min-w-0 px-3 py-2.5 align-top">
                      <p className="truncate font-medium text-text-primary" title={participant.name}>{participant.name}{cancelled ? " (cancelado)" : ""}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">{formatCurrency(participant.amount_due)} devidos · {formatCurrency(participant.total_paid)} pagos{participant.phone ? ` · ${participant.phone}` : ""}</p>
                      {!participant.eligible_for_prize_share && participant.ineligible_reason ? <p className="mt-1 text-xs text-warning">Fora do rateio: {participant.ineligible_reason}</p> : null}
                      {participant.adjustment_reason ? <p className="mt-1 text-xs text-text-secondary">Ajuste: {formatCurrency(participant.amount_adjustment)} — {participant.adjustment_reason}</p> : null}
                      {canManage && !cancelled ? <ParticipantActions participant={participant} openForChanges={openForChanges} pending={eligibilityMutation.isPending} onPay={onPay} onEdit={openEdit} onEligibility={() => { if (participant.eligible_for_prize_share) { setEligibilityError(null); setEligibilityTarget(participant); } else eligibilityMutation.mutate({ id: participant.id, eligible: true }); }} onCancel={() => { setCancelError(null); setCancelTarget(participant); }} /> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-text-secondary">{quotaText(participant.quotas)}</td>
                    <td className="px-3 py-2.5 align-top"><StatusBadge label={paymentLabel(participant.payment_status)} tone={paymentStatusTone[participant.payment_status]} className="whitespace-nowrap" /></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ParticipantFormDialog
        pool={pool}
        participant={editTarget}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditTarget(null);
        }}
        maxQuotas={maxQuotasFor(editTarget)}
      />


      <ReasonDialog
        open={eligibilityTarget !== null}
        onOpenChange={(next) => (!next ? setEligibilityTarget(null) : undefined)}
        title="Tirar do rateio?"
        description={
          eligibilityTarget
            ? `${eligibilityTarget.name} deixa de receber parte do prêmio. O rateio já calculado passa a ficar desatualizado e precisa ser recalculado.`
            : ""
        }
        fieldLabel="Motivo"
        placeholder="Ex.: não concluiu o pagamento."
        confirmLabel="Tirar do rateio"
        cancelLabel="Voltar"
        loading={eligibilityMutation.isPending}
        error={eligibilityError}
        onConfirm={(reason) =>
          eligibilityTarget
            ? eligibilityMutation.mutate({ id: eligibilityTarget.id, eligible: false, reason })
            : undefined
        }
      />

      <ReasonDialog
        open={cancelTarget !== null}
        onOpenChange={(next) => (!next ? setCancelTarget(null) : undefined)}
        title="Cancelar participante?"
        description={
          cancelTarget
            ? `${cancelTarget.name} sai do bolão e do rateio. Os pagamentos já registrados são preservados no histórico.`
            : ""
        }
        fieldLabel="Motivo do cancelamento"
        placeholder="Ex.: desistiu de participar."
        confirmLabel="Cancelar participante"
        cancelLabel="Voltar"
        destructive
        loading={cancelMutation.isPending}
        error={cancelError}
        onConfirm={(reason) =>
          cancelTarget ? cancelMutation.mutate({ id: cancelTarget.id, reason }) : undefined
        }
      />
    </div>
  );
}

function SortButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <Button type="button" variant="ghost" size="sm" className="h-8 px-1 uppercase" aria-pressed={active} onClick={onClick}>{active ? <ArrowDownAZ aria-hidden /> : <ArrowDownUp aria-hidden />}{label}</Button>;
}

function ParticipantActions({ participant, openForChanges, pending, onPay, onEdit, onEligibility, onCancel }: { participant: PoolParticipantRow; openForChanges: boolean; pending: boolean; onPay: (participant: PoolParticipantRow) => void; onEdit: (participant: PoolParticipantRow) => void; onEligibility: () => void; onCancel: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onPay(participant)}>
                      <Wallet className="size-4" aria-hidden />
                      Registrar pagamento
                    </Button>
                    {openForChanges ? (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(participant)}>
                        <Pencil className="size-4" aria-hidden />
                        Editar
                      </Button>
                    ) : null}

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={onEligibility}
                    >
                      <UserMinus className="size-4" aria-hidden />
                      {participant.eligible_for_prize_share ? "Tirar do rateio" : "Voltar ao rateio"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={onCancel}
                    >
                      <Ban className="size-4" aria-hidden />
                      Cancelar
                    </Button>
    </div>
  );
}
