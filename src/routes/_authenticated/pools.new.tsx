import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { appConfig } from "@/config/app.config";
import { useSession } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/format";
import { lotteryDataService } from "@/lib/services/lotteryDataService";
import { poolService } from "@/lib/services/poolService";

export const Route = createFileRoute("/_authenticated/pools/new")({
  head: () => ({
    meta: [
      { title: `Novo bolão — ${appConfig.name}` },
      { name: "description", content: "Criação de bolão com cotas e prazo de pagamento." },
      { property: "og:title", content: `Novo bolão — ${appConfig.name}` },
      { property: "og:description", content: "Criação de bolão com cotas e prazo de pagamento." },
    ],
  }),
  component: NewPoolPage,
});

function NewPoolPage() {
  const navigate = useNavigate();
  const { user } = useSession();

  const lotteries = useQuery({
    queryKey: ["lotteries"],
    queryFn: () => lotteryDataService.listLotteries(),
  });

  const [lotteryId, setLotteryId] = useState("");
  const [name, setName] = useState("");
  const [contest, setContest] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [quotaValue, setQuotaValue] = useState("");
  const [totalQuotas, setTotalQuotas] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");

  const parsedTotal = totalQuotas.trim() === "" ? null : Number(totalQuotas);
  const total = parsedTotal === null ? 0 : Number(quotaValue) * parsedTotal;


  const create = useMutation({
    mutationFn: () =>
      poolService.create({
        ownerId: user!.id,
        lotteryId,
        name: name.trim(),
        contestNumber: contest ? Number(contest) : null,
        drawDate: drawDate || null,
        quotaValue: Number(quotaValue),
        totalQuotas: Number(totalQuotas),
        paymentDeadline: deadline || null,
        notes: notes.trim() || null,
      }),
    onSuccess: (id) => {
      toast.success("Bolão criado");
      void navigate({ to: "/pools/$id", params: { id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = () => {
    if (!user) {
      toast.error("Entre na sua conta para criar um bolão.");
      return;
    }
    if (!lotteryId) {
      toast.error("Escolha a modalidade.");
      return;
    }
    if (!name.trim()) {
      toast.error("Dê um nome ao bolão.");
      return;
    }
    if (!(Number(quotaValue) > 0)) {
      toast.error("O valor da cota deve ser maior que zero.");
      return;
    }
    if (!Number.isInteger(Number(totalQuotas)) || Number(totalQuotas) < 1) {
      toast.error("O total de cotas deve ser um número inteiro maior que zero.");
      return;
    }
    create.mutate();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Novo bolão"
        description="Você poderá ajustar participantes, jogos e prazos depois de criar."
        actions={
          <Button asChild variant="outline" size="sm" className="h-11">
            <Link to="/pools">Voltar</Link>
          </Button>
        }
      />

      <div className="surface-card space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pool-lottery">Modalidade</Label>
            <select
              id="pool-lottery"
              className="touch-target w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary"
              value={lotteryId}
              onChange={(event) => setLotteryId(event.target.value)}
            >
              <option value="">Escolha…</option>
              {(lotteries.data ?? []).map((lottery) => (
                <option key={lottery.id} value={lottery.id}>
                  {lottery.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-name">Nome do bolão</Label>
            <Input
              id="pool-name"
              className="h-11"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pool-contest">Concurso (opcional)</Label>
            <Input
              id="pool-contest"
              className="h-11"
              inputMode="numeric"
              value={contest}
              onChange={(event) => setContest(event.target.value)}
              placeholder="Deixe vazio para definir depois"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-draw-date">Data prevista do sorteio</Label>
            <Input
              id="pool-draw-date"
              type="date"
              className="h-11"
              value={drawDate}
              onChange={(event) => setDrawDate(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pool-quota-value">Valor da cota</Label>
            <Input
              id="pool-quota-value"
              className="h-11"
              inputMode="decimal"
              value={quotaValue}
              onChange={(event) => setQuotaValue(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-total-quotas">Total de cotas</Label>
            <Input
              id="pool-total-quotas"
              className="h-11"
              inputMode="numeric"
              value={totalQuotas}
              onChange={(event) => setTotalQuotas(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool-deadline">Prazo de pagamento</Label>
            <Input
              id="pool-deadline"
              type="date"
              className="h-11"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pool-notes">Observações</Label>
          <Textarea
            id="pool-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {total > 0 ? (
          <p className="text-sm text-text-secondary">
            Arrecadação prevista: <strong className="text-text-primary">{formatCurrency(total)}</strong>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button className="h-11" onClick={submit} disabled={create.isPending}>
            Criar bolão
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link to="/pools">Cancelar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
