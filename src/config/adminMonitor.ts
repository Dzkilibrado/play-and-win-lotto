/**
 * Catálogo dos indicadores do Monitor da Administração.
 *
 * Para acrescentar um indicador (ex.: chamados), basta incluir um item aqui e
 * devolver o valor em `admin_monitor_snapshot`. A tela, a personalização e a
 * ordem funcionam sem outra alteração.
 */
import type { StatusTone } from "@/types/domain";

export type MonitorLevel = "ok" | "attention" | "critical" | "neutral";
export type MonitorArea = "Atualização" | "Conferência" | "Loterias" | "Usuários";

export interface MonitorSnapshot {
  sync_attention: number;
  sync_late: number;
  sync_max_failures: number;
  sync_last_success: string | null;
  next_draw_failures: number;
  check_failed_jobs: number;
  check_queue: number;
  lotteries_maintenance: number;
  lotteries_disabled: number;
  new_users_7d: number;
  generated_at: string;
}

export interface MonitorItemDef {
  key: string;
  title: string;
  hint: string;
  area: MonitorArea;
  href: string;
  /** Aparece por padrão para quem ainda não personalizou. */
  defaultEnabled: boolean;
  read: (snapshot: MonitorSnapshot, now: Date) => { value: string; level: MonitorLevel };
}

const count = (value: number, warnAt: number, criticalAt?: number) => ({
  value: String(value),
  level: (criticalAt != null && value >= criticalAt
    ? "critical"
    : value >= warnAt
      ? "attention"
      : "ok") as MonitorLevel,
});

function hoursSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? (now.getTime() - time) / 3_600_000 : null;
}

export const monitorItems: readonly MonitorItemDef[] = [
  {
    key: "sync_attention",
    title: "Loterias que exigem atenção",
    hint: "Atualização automática parada ou com erro persistente.",
    area: "Atualização",
    href: "/admin/atualizacao",
    defaultEnabled: true,
    read: (s) => count(s.sync_attention, 1, 1),
  },
  {
    key: "sync_late",
    title: "Resultados atrasados",
    hint: "Sorteio realizado há mais de 3 h e ainda sem resultado publicado.",
    area: "Atualização",
    href: "/admin/atualizacao",
    defaultEnabled: true,
    read: (s) => count(s.sync_late, 1),
  },
  {
    key: "sync_max_failures",
    title: "Falhas seguidas na atualização",
    hint: "Maior número de tentativas sem sucesso entre as loterias.",
    area: "Atualização",
    href: "/admin/atualizacao",
    defaultEnabled: true,
    read: (s) => count(s.sync_max_failures, 3, 8),
  },
  {
    key: "sync_last_success",
    title: "Última atualização com sucesso",
    hint: "A mais antiga entre as loterias com atualização ligada.",
    area: "Atualização",
    href: "/admin/atualizacao",
    defaultEnabled: true,
    read: (s, now) => {
      const hours = hoursSince(s.sync_last_success, now);
      if (hours == null) return { value: "Sem registro", level: "attention" };
      const value =
        hours < 1
          ? "menos de 1 h"
          : hours < 48
            ? `${Math.floor(hours)} h`
            : `${Math.floor(hours / 24)} dias`;
      return { value: `há ${value}`, level: hours > 36 ? "attention" : "ok" };
    },
  },
  {
    key: "next_draw_failures",
    title: "Falhas no próximo sorteio",
    hint: "Loterias cujo calendário do próximo sorteio não atualizou.",
    area: "Atualização",
    href: "/admin/atualizacao",
    defaultEnabled: true,
    read: (s) => count(s.next_draw_failures, 1),
  },
  {
    key: "check_failed_jobs",
    title: "Conferências com falha",
    hint: "Conferências de concurso que terminaram com erro.",
    area: "Conferência",
    href: "/admin/conferencia",
    defaultEnabled: true,
    read: (s) => count(s.check_failed_jobs, 1, 1),
  },
  {
    key: "check_queue",
    title: "Conferências na fila",
    hint: "Concursos aguardando ou em conferência dos jogos.",
    area: "Conferência",
    href: "/admin/conferencia",
    defaultEnabled: false,
    read: (s) => ({ value: String(s.check_queue), level: "neutral" }),
  },
  {
    key: "lotteries_maintenance",
    title: "Loterias em manutenção",
    hint: "Novos jogos e bolões pausados.",
    area: "Loterias",
    href: "/admin/loterias",
    defaultEnabled: true,
    read: (s) => count(s.lotteries_maintenance, 1),
  },
  {
    key: "lotteries_disabled",
    title: "Loterias desabilitadas",
    hint: "Aparecem só como informação, sem jogos.",
    area: "Loterias",
    href: "/admin/loterias",
    defaultEnabled: false,
    read: (s) => ({ value: String(s.lotteries_disabled), level: "neutral" }),
  },
  {
    key: "new_users_7d",
    title: "Novos usuários (7 dias)",
    hint: "Cadastros recentes.",
    area: "Usuários",
    href: "/admin/users",
    defaultEnabled: false,
    read: (s) => ({ value: String(s.new_users_7d), level: "neutral" }),
  },
];

export const levelTone: Record<MonitorLevel, StatusTone> = {
  ok: "success",
  attention: "warning",
  critical: "danger",
  neutral: "neutral",
};

export const levelLabel: Record<MonitorLevel, string> = {
  ok: "Normal",
  attention: "Atenção",
  critical: "Crítico",
  neutral: "Informativo",
};
