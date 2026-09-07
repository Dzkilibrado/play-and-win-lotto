/**
 * Edição do bolão pelo organizador.
 * O formulário apenas orienta e pede confirmação: quem valida de verdade
 * (permissão, limite de cotas, concurso, modalidade, situação) é a função
 * protegida `pool_update_details` no banco.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { poolService, type PoolRow } from "@/lib/services/poolService";

const structuralStatuses = ["FORMING", "OPEN", "CLOSED"];

export function PoolEditDialog({
  pool,
  open,
  onOpenChange,
}: {
  pool: PoolRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const lotteries = useQuery({
    queryKey: ["lotteries"],
    queryFn: () => lotteryDataService.listLotteries(),
    enabled: open,
  });

  const currentContest = pool.contest_number ?? pool.contest_number_planned;
  const currentDrawDate = pool.draw_date ?? pool.draw_date_planned;

  const [lotteryId, setLotteryId] = useState(pool.lottery_id);
  const [name, setName] = useState(pool.name);
  const [contest, setContest] = useState(currentContest ? String(currentContest) : "");
  const [drawDate, setDrawDate] = useState(currentDrawDate ?? "");
  const [quotaValue, setQuotaValue] = useState(String(pool.quota_value));
  const [totalQuotas, setTotalQuotas] = useState(
    pool.total_quotas === null ? "" : String(pool.total_quotas),
  );
  const [deadline, setDeadline] = useState(pool.payment_deadline ?? "");
  const [notes, setNotes] = useState(pool.notes ?? "");

  useEffect(() => {
    if (!open) return;
    setLotteryId(pool.lottery_id);
    setName(pool.name);
    setContest(currentContest ? String(currentContest) : "");
    setDrawDate(currentDrawDate ?? "");
    setQuotaValue(String(pool.quota_value));
    setTotalQuotas(pool.total_quotas === null ? "" : String(pool.total_quotas));
    setDeadline(pool.payment_deadline ?? "");
    setNotes(pool.notes ?? "");
  }, [open, pool, currentContest, currentDrawDate]);

  const active = pool.pool_participants.filter((p) => p.status === "ACTIVE");
  const quotasTaken = active.reduce((sum, p) => sum + p.quotas, 0);
  const hasPayments = active.some((p) => Number(p.total_paid) > 0);
  const hasGames = pool.pool_games.length > 0;
  const structural = structuralStatuses.includes(pool.status);

  const parsedTotal = totalQuotas.trim() === "" ? null : Number(totalQuotas);
  const parsedQuota = Number(quotaValue);

  const mutation = useMutation({
    mutationFn: () =>
      poolService.update(pool.id, {
        name: name.trim(),
        ...(structural
          ? {
              lotteryId,
              contestNumber: contest.trim() === "" ? null : Number(contest),
              drawDate: drawDate || null,
              quotaValue: parsedQuota,
              totalQuotas: parsedTotal,
              paymentDeadline: deadline || null,
            }
          : {}),
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Bolão atualizado");
      void queryClient.invalidateQueries({ queryKey: ["pool", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pool-events", pool.id] });
      void queryClient.invalidateQueries({ queryKey: ["pools"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    if (!name.trim()) {
      toast.error("Dê um nome ao bolão.");
      return;
    }
    if (structural) {
      if (!(parsedQuota > 0)) {
        toast.error("O valor da cota deve ser maior que zero.");
        return;
      }
      if (parsedTotal !== null && (!Number.isInteger(parsedTotal) || parsedTotal < 1)) {
        toast.error("Deixe o total de cotas em branco ou informe um número inteiro maior que zero.");
        return;
      }
      if (parsedTotal !== null && parsedTotal < quotasTaken) {
        toast.error(
          `Não é possível definir ${parsedTotal} cotas porque o bolão já possui ${quotasTaken} cotas atribuídas.`,
        );
        return;
      }
      if (parsedTotal === null && pool.total_quotas !== null) {
        const ok = window.confirm(
          "Ao remover o limite, o bolão passa a aceitar cotas sem um máximo e os indicadores de cotas disponíveis deixam de existir. Confirmar?",
        );
        if (!ok) return;
      }
      if (parsedQuota !== Number(pool.quota_value) && active.length > 0) {
        const ok = window.confirm(
          hasPayments
            ? `O valor devido de cada participante será recalculado com ${formatCurrency(parsedQuota)} por cota. Os pagamentos já registrados são preservados e a situação de pagamento pode mudar. Confirmar?`
            : `O valor devido de cada participante será recalculado com ${formatCurrency(parsedQuota)} por cota. Confirmar?`,
        );
        if (!ok) return;
      }
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar bolão</DialogTitle>
          <DialogDescription>
            {structural
              ? "Participantes, pagamentos, jogos e histórico são preservados."
              : "Nesta situação do bolão só é possível ajustar o nome e as observações."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-pool-name">Nome do bolão</Label>
            <Input
              id="edit-pool-name"
              className="h-11"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {structural ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="edit-pool-lottery">Modalidade</Label>
                <select
                  id="edit-pool-lottery"
                  className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary disabled:opacity-60"
                  value={lotteryId}
                  disabled={hasGames}
                  onChange={(event) => setLotteryId(event.target.value)}
                >
                  {(lotteries.data ?? []).map((lottery) => (
                    <option key={lottery.id} value={lottery.id}>
                      {lottery.name}
                    </option>
                  ))}
                </select>
                {hasGames ? (
                  <p className="text-xs text-text-secondary">
                    A modalidade fica bloqueada porque já existem jogos neste bolão.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pool-contest">Concurso</Label>
                  <Input
                    id="edit-pool-contest"
                    className="h-11"
                    inputMode="numeric"
                    value={contest}
                    disabled={hasGames}
                    onChange={(event) => setContest(event.target.value)}
                  />
                  {hasGames ? (
                    <p className="text-xs text-text-secondary">
                      O concurso fica bloqueado porque já existem jogos neste bolão.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pool-draw-date">Data prevista do sorteio</Label>
                  <Input
                    id="edit-pool-draw-date"
                    type="date"
                    className="h-11"
                    value={drawDate}
                    onChange={(event) => setDrawDate(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pool-quota-value">Valor da cota</Label>
                  <Input
                    id="edit-pool-quota-value"
                    className="h-11"
                    inputMode="decimal"
                    value={quotaValue}
                    onChange={(event) => setQuotaValue(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pool-total-quotas">
                    Total de cotas <span className="text-text-secondary">(opcional)</span>
                  </Label>
                  <Input
                    id="edit-pool-total-quotas"
                    className="h-11"
                    inputMode="numeric"
                    placeholder="Sem limite"
                    value={totalQuotas}
                    onChange={(event) => setTotalQuotas(event.target.value)}
                  />
                  <p className="text-xs text-text-secondary">
                    Em branco = sem limite. Hoje há {quotasTaken}{" "}
                    {quotasTaken === 1 ? "cota atribuída" : "cotas atribuídas"}.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pool-deadline">Prazo de pagamento</Label>
                  <Input
                    id="edit-pool-deadline"
                    type="date"
                    className="h-11"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="edit-pool-notes">Observações</Label>
            <Textarea
              id="edit-pool-notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={submit} disabled={mutation.isPending}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
