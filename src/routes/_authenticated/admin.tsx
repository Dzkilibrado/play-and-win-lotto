import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateViews";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app.config";
import { syncConfig } from "@/config/sync.config";
import { useIsAdmin, useSession } from "@/hooks/useAuth";
import { formatDate, formatNumber } from "@/lib/format";
import { getSyncOverview, listSyncErrors, runSyncBatch, startSync } from "@/lib/sync.functions";
import type { StatusTone } from "@/types/domain";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: `Administração — ${appConfig.name}` },
      { name: "description", content: "Área administrativa do aplicativo." },
      { property: "og:title", content: `Administração — ${appConfig.name}` },
      { property: "og:description", content: "Área administrativa do aplicativo." },
    ],
  }),
  component: AdminPage,
});

const statusTone: Record<string, StatusTone> = {
  pending: "info",
  running: "info",
  completed: "success",
  completed_with_errors: "warning",
  failed: "danger",
};

const statusLabel: Record<string, string> = {
  pending: "Na fila",
  running: "Em andamento",
  completed: "Concluída",
  completed_with_errors: "Concluída com erros",
  failed: "Falhou",
};

function AdminPage() {
  const { user } = useSession();
  const isAdmin = useIsAdmin(user);

  if (isAdmin.isLoading) return <LoadingState rows={2} />;

  if (!isAdmin.data) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Esta área é exclusiva para administradores. As regras de acesso também são aplicadas no banco de dados."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Administração" description="Gestão de dados e recursos do sistema." />
      <SyncPanel />
    </div>
  );
}

function SyncPanel() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const overviewFn = useServerFn(getSyncOverview);
  const startFn = useServerFn(startSync);
  const batchFn = useServerFn(runSyncBatch);
  const errorsFn = useServerFn(listSyncErrors);

  const overview = useQuery({ queryKey: ["sync-overview"], queryFn: () => overviewFn({}) });
  const errors = useQuery({ queryKey: ["sync-errors"], queryFn: () => errorsFn({}) });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sync-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["sync-errors"] }),
      queryClient.invalidateQueries({ queryKey: ["latest-draws"] }),
      queryClient.invalidateQueries({ queryKey: ["recent-results"] }),
      queryClient.invalidateQueries({ queryKey: ["results"] }),
      queryClient.invalidateQueries({ queryKey: ["contests"] }),
    ]);
  };

  const action = useMutation({
    mutationFn: async (input: {
      slug: string;
      type: "LATEST" | "RECENT" | "HISTORICAL" | "REPROCESS";
    }) => {
      const started = await startFn({ data: input });
      if (started.kind === "job" && input.type === "HISTORICAL") {
        let status = started.status;
        let guard = 0;
        while (status !== "completed" && status !== "completed_with_errors" && status !== "failed" && guard < 500) {
          const step = await batchFn({ data: { jobId: started.jobId } });
          status = step.status;
          guard += 1;
          setProgress(
            `${input.slug}: ${formatNumber(step.processed)} concursos processados · ${formatNumber(
              step.inserted,
            )} novos · ${formatNumber(step.failed)} com erro`,
          );
          await queryClient.invalidateQueries({ queryKey: ["sync-overview"] });
        }
      }
      return started;
    },
    onMutate: (input) => setBusy(`${input.slug}:${input.type}`),
    onSuccess: async () => {
      toast.success("Sincronização concluída.");
      await refreshAll();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => {
      setBusy(null);
      setProgress(null);
    },
  });

  if (overview.isLoading) return <LoadingState rows={3} />;
  if (overview.isError) return <ErrorState onRetry={() => overview.refetch()} />;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">
          Dados das loterias
        </h2>
        <p className="mt-1 text-xs text-text-secondary">Fonte: {syncConfig.sourceLabel}</p>
        {progress && <p className="mt-2 text-xs text-info">{progress}</p>}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {(overview.data ?? []).map((row) => (
          <article key={row.lotteryId} className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-text-primary">{row.name}</h3>
                <p className="text-xs text-text-secondary">
                  {formatNumber(row.totalContests)} concursos no banco
                </p>
              </div>
              {row.job && (
                <StatusBadge
                  tone={statusTone[row.job.status] ?? "neutral"}
                  label={statusLabel[row.job.status] ?? row.job.status}
                />
              )}
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-text-secondary">Primeiro concurso</dt>
                <dd className="font-medium text-text-primary">{row.firstContest ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Último concurso</dt>
                <dd className="font-medium text-text-primary">{row.lastContest ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Data do último</dt>
                <dd className="font-medium text-text-primary">{formatDate(row.lastContestDate)}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Concursos com erro</dt>
                <dd className="font-medium text-text-primary">{formatNumber(row.pendingErrors)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["LATEST", "Sincronizar último"],
                  ["RECENT", "Atualizar recentes"],
                  ["HISTORICAL", "Importação histórica"],
                  ["REPROCESS", "Reprocessar falhas"],
                ] as const
              ).map(([type, label]) => (
                <Button
                  key={type}
                  size="sm"
                  variant={type === "HISTORICAL" ? "default" : "outline"}
                  className="h-11"
                  disabled={busy !== null}
                  onClick={() => action.mutate({ slug: row.slug, type })}
                >
                  {busy === `${row.slug}:${type}` ? "Executando…" : label}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-display text-sm font-semibold text-text-primary">
          Últimos erros de sincronização
        </h2>
        {(errors.data ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-text-secondary">Nenhum erro pendente.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs">
            {(errors.data ?? []).map((item) => (
              <li key={item.id} className="rounded-lg bg-surface-secondary px-3 py-2">
                <span className="font-medium text-text-primary">
                  Concurso {item.contest_number ?? "—"} · {item.error_type}
                </span>
                <span className="block text-text-secondary">{item.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
