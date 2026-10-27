import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, LoadingState } from "@/components/common/StateViews";
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
import { Switch } from "@/components/ui/switch";
import { levelLabel, levelTone, type MonitorLevel } from "@/config/adminMonitor";
import { useAdminMonitor } from "@/hooks/useAdminMonitor";
import {
  moveEntry,
  summarize,
  toggleEntry,
  toPrefRows,
  type MonitorEntry,
} from "@/lib/admin/monitor";
import { cn } from "@/lib/utils";

const tileClasses: Record<MonitorLevel, string> = {
  ok: "border-success/40 bg-success-soft",
  attention: "border-warning/50 bg-warning-soft",
  critical: "border-danger/50 bg-danger-soft",
  neutral: "border-border bg-surface",
};

/** Painel de indicadores do administrador: o que aparece e a ordem são dele. */
export function AdminMonitor({ userId }: { userId: string }) {
  const { snapshot, prefs, entries, save } = useAdminMonitor(userId);
  const [editing, setEditing] = useState(false);

  if (snapshot.isLoading || prefs.isLoading) return <LoadingState rows={2} />;
  if (snapshot.isError || !snapshot.data) {
    return <ErrorState onRetry={() => snapshot.refetch()} />;
  }

  const now = new Date();
  const summary = summarize(entries, snapshot.data, now);
  const visible = entries.filter((entry) => entry.enabled);
  const headline =
    summary.shown === 0
      ? "Nenhum indicador escolhido"
      : summary.critical > 0
        ? `${summary.critical} ponto(s) crítico(s)`
        : summary.attention > 0
          ? `${summary.attention} ponto(s) de atenção`
          : "Tudo em ordem";

  return (
    <section aria-labelledby="monitor-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="monitor-title" className="font-display text-base font-semibold text-text-primary">
            Monitor
          </h2>
          <p
            className={cn(
              "text-sm",
              summary.critical > 0
                ? "text-danger"
                : summary.attention > 0
                  ? "text-warning"
                  : "text-text-secondary",
            )}
            role="status"
          >
            {headline}
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-11" onClick={() => setEditing(true)}>
          <Settings2 className="size-4" aria-hidden />
          Personalizar
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="surface-card p-4 text-sm text-text-secondary">
          Use “Personalizar” para escolher o que acompanhar aqui.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(({ item }) => {
            const reading = item.read(snapshot.data!, now);
            return (
              <li key={item.key}>
                <Link
                  to={item.href}
                  className={cn(
                    "tappable flex min-h-20 flex-col justify-between gap-1 rounded-xl border p-3",
                    tileClasses[reading.level],
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-text-secondary">{item.area}</span>
                    <StatusBadge
                      label={levelLabel[reading.level]}
                      tone={levelTone[reading.level]}
                    />
                  </span>
                  <span className="font-display text-xl font-semibold text-text-primary">
                    {reading.value}
                  </span>
                  <span className="text-sm text-text-primary">{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CustomizeDialog
        open={editing}
        onOpenChange={setEditing}
        entries={entries}
        saving={save.isPending}
        onSave={async (next) => {
          try {
            await save.mutateAsync(toPrefRows(next));
            toast.success("Monitor atualizado");
            setEditing(false);
          } catch {
            toast.error("Não foi possível salvar. Tente novamente.");
          }
        }}
      />
    </section>
  );
}

function CustomizeDialog({
  open,
  onOpenChange,
  entries,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: MonitorEntry[];
  saving: boolean;
  onSave: (entries: MonitorEntry[]) => void;
}) {
  const [draft, setDraft] = useState<MonitorEntry[]>(entries);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(entries);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Personalizar o Monitor</DialogTitle>
          <DialogDescription>
            Ligue o que quer acompanhar e use as setas para mudar a ordem.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {draft.map((entry, index) => (
            <li
              key={entry.item.key}
              className="flex items-center gap-2 rounded-lg border border-border p-2"
            >
              <Switch
                checked={entry.enabled}
                onCheckedChange={() => setDraft((current) => toggleEntry(current, entry.item.key))}
                aria-label={`Mostrar ${entry.item.title}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text-primary">
                  {entry.item.title}
                </span>
                <span className="block text-xs text-text-secondary">{entry.item.hint}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                disabled={index === 0}
                onClick={() => setDraft((current) => moveEntry(current, entry.item.key, -1))}
                aria-label={`Subir ${entry.item.title}`}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                disabled={index === draft.length - 1}
                onClick={() => setDraft((current) => moveEntry(current, entry.item.key, 1))}
                aria-label={`Descer ${entry.item.title}`}
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-11" disabled={saving} onClick={() => onSave(draft)}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
