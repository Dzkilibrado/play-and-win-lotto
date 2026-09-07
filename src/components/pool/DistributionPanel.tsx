import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, CheckCircle2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { MetricCard } from "@/components/common/Cards";
import { EmptyState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { distributionStatusLabel, poolNotices } from "@/config/pools.config";
import { formatCurrency, formatDate } from "@/lib/format";
import { poolService, type PoolParticipantRow, type PoolRow } from "@/lib/services/poolService";
import type { StatusTone } from "@/types/domain";

const statusTone: Record<string, StatusTone> = {
  CALCULATED: "info",
  CONFIRMED: "success",
  OUTDATED: "warning",
};

export function DistributionPanel({
  pool,
  participants,
  canManage,
}: {
  pool: PoolRow;
  participants: PoolParticipantRow[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();

  const prize = useQuery({
    queryKey: ["pool-prize", pool.id],
    queryFn: () => poolService.prizeTotal(pool.id),
  });

  const distributions = useQuery({
    queryKey: ["pool-distributions", pool.id],
    queryFn: () => poolService.distributions(pool.id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["pool-distributions", pool.id] });
    void queryClient.invalidateQueries({ queryKey: ["pool-prize", pool.id] });
  };

  const calculate = useMutation({
    mutationFn: () => poolService.calculateDistribution(pool.id),
    onSuccess: () => {
      toast.success("Rateio calculado");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => poolService.confirmDistribution(id),
    onSuccess: () => {
      toast.success("Rateio confirmado");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current = (distributions.data ?? [])[0] ?? null;
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Participante";
  const totalPrize = prize.data ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Prêmio conferido" value={formatCurrency(totalPrize)} />
        <MetricCard
          label="Cotas no rateio"
          value={`${participants.filter((p) => p.status === "ACTIVE" && p.eligible_for_prize_share).reduce((s, p) => s + p.quotas, 0)}`}
        />
        <MetricCard
          label="Valor por cota"
          value={current ? formatCurrency(Number(current.value_per_quota)) : "—"}
        />
        <MetricCard
          label="Situação"
          value={current ? distributionStatusLabel[current.status] : "Não calculado"}
        />
      </div>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-11"
            onClick={() => calculate.mutate()}
            disabled={calculate.isPending}
          >
            <Calculator className="size-4" aria-hidden />
            {current ? "Recalcular rateio" : "Calcular rateio"}
          </Button>
          {current && current.status !== "CONFIRMED" ? (
            <Button
              size="sm"
              variant="outline"
              className="h-11"
              onClick={() => confirm.mutate(current.id)}
              disabled={current.status === "OUTDATED" || confirm.isPending}
            >
              <CheckCircle2 className="size-4" aria-hidden />
              Confirmar rateio
            </Button>
          ) : null}
        </div>
      ) : null}

      {current?.status === "OUTDATED" ? (
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
          {poolNotices.distributionOutdated}
        </p>
      ) : null}

      {!current ? (
        <EmptyState
          icon={Trophy}
          title="Rateio ainda não calculado"
          description="Assim que a conferência oficial registrar o prêmio, calcule a divisão entre os participantes."
        />
      ) : (
        <div className="surface-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Rateio — versão {current.version}
              </h2>
              <p className="text-xs text-text-secondary">
                Calculado em {formatDate(current.calculated_at)} ·{" "}
                {formatCurrency(Number(current.total_prize))} entre {current.total_eligible_quotas}{" "}
                cotas
              </p>
            </div>
            <StatusBadge
              label={distributionStatusLabel[current.status]}
              tone={statusTone[current.status] ?? "neutral"}
            />
          </div>

          <ul className="mt-3 divide-y divide-border">
            {[...current.pool_prize_participants]
              .sort((a, b) => b.share_amount - a.share_amount)
              .map((share) => (
                <li key={share.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate text-text-primary">{nameOf(share.participant_id)}</span>
                  <span className="shrink-0 text-text-secondary">
                    {share.eligible_quotas} {share.eligible_quotas === 1 ? "cota" : "cotas"} ·{" "}
                    <span className="font-medium text-text-primary">
                      {formatCurrency(Number(share.share_amount))}
                    </span>
                  </span>
                </li>
              ))}
          </ul>

          {Number(current.rounding_remainder) > 0 ? (
            <p className="mt-2 text-xs text-text-secondary">
              Sobra de {formatCurrency(Number(current.rounding_remainder))} distribuída em centavos
              para as maiores cotas, para que a soma feche exatamente com o prêmio.
            </p>
          ) : null}
        </div>
      )}

      <p className="text-xs text-text-secondary">{poolNotices.distribution}</p>
    </div>
  );
}
