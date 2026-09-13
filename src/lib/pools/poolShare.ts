/**
 * Fonte única de comportamento do compartilhamento de bolões.
 * Toda ação de compartilhar (nativo, WhatsApp, copiar) usa estas funções —
 * nenhum botão deve montar mensagem ou URL por conta própria.
 */
import type { PoolRow, PoolShareScope } from "@/lib/services/poolService";
import { formatDate } from "@/lib/format";
import { publicAppUrl } from "@/config/app.config";

export const poolShareScopeLabel: Record<PoolShareScope, string> = {
  PARTICIPANTS: "Participantes",
  GAMES: "Jogos",
  FULL: "Completo",
};

export const poolShareScopeDescription: Record<PoolShareScope, string> = {
  PARTICIPANTS: "Lista de participantes, cotas e situação de pagamento.",
  GAMES: "Jogos liberados para conferência e acompanhamento.",
  FULL: "Resumo do bolão, participantes e jogos.",
};

/** Link público ativo para um escopo, ou `null` quando ainda não foi criado. */
export function poolPublicUrl(
  pool: PoolRow,
  scope: PoolShareScope,
  origin?: string,
): string | null {
  const link = pool.pool_share_links?.find((item) => item.scope === scope && !item.revoked_at);
  if (!link) return null;
  if (origin) return new URL(`/b/${link.token}`, `${origin}/`).toString();
  return publicAppUrl(`/b/${link.token}`);
}

export function poolShareTitle(pool: PoolRow) {
  return `Bolão: ${pool.name}`;
}

export interface PoolShareStats {
  participants: number;
  paidQuotas: number;
  games: number;
  confirmedBets: number;
  plannedGames: number;
}

export function poolShareStats(pool: PoolRow): PoolShareStats {
  const active = pool.pool_participants.filter((participant) => participant.status === "ACTIVE");
  const paid = active.filter((participant) => participant.payment_status === "PAID");
  return {
    participants: paid.length,
    paidQuotas: paid.reduce((sum, participant) => sum + participant.quotas, 0),
    games: pool.pool_games.length,
    confirmedBets: pool.pool_games.filter((item) => item.generated_games?.status !== "PLANNED").length,
    plannedGames: pool.pool_games.filter((item) => item.generated_games?.status === "PLANNED").length,
  };
}

export function poolGamesSummary(stats: Pick<PoolShareStats, "games" | "confirmedBets" | "plannedGames">) {
  const total = `${stats.games} ${stats.games === 1 ? "jogo" : "jogos"}`;
  if (stats.games > 0 && stats.confirmedBets === stats.games) return `${total} · Todos apostados`;
  if (stats.games > 0 && stats.plannedGames === stats.games) return `${total} · Todos planejados`;
  if (stats.plannedGames > 0) {
    return `${total} · ${stats.confirmedBets} apostados · ${stats.plannedGames} planejados`;
  }
  return total;
}

export function poolSharePreview(pool: PoolRow, scope: PoolShareScope): string[] {
  const stats = poolShareStats(pool);
  if (scope === "PARTICIPANTS") {
    return [
      `${stats.participants} ${stats.participants === 1 ? "participante confirmado" : "participantes confirmados"}`,
      `${stats.paidQuotas} ${stats.paidQuotas === 1 ? "cota paga" : "cotas pagas"}`,
      "Situação de pagamento",
    ];
  }
  if (scope === "GAMES") {
    return [poolGamesSummary(stats), "Dezenas e situação de cada jogo"];
  }
  return [
    `${stats.participants} ${stats.participants === 1 ? "participante confirmado" : "participantes confirmados"} · ${stats.paidQuotas} ${stats.paidQuotas === 1 ? "cota paga" : "cotas pagas"}`,
    poolGamesSummary(stats),
  ];
}

/** Mensagem padrão de acompanhamento (com e sem limite de cotas). */
export function poolShareMessage(pool: PoolRow, scope: PoolShareScope, url: string | null): string {
  const contest = pool.contest_number ?? pool.contest_number_planned;
  const drawDate = pool.draw_date ?? pool.draw_date_planned;
  const stats = poolShareStats(pool);
  const lottery = pool.lotteries?.name ?? "Loteria";
  const contestLine = contest ? `${lottery} · Concurso ${contest}` : `${lottery} · Concurso a definir`;
  const lines = [`Bolão: ${pool.name}`, contestLine];
  if (drawDate) lines.push(`Sorteio: ${formatDate(drawDate)}`);

  lines.push("");
  if (scope === "PARTICIPANTS") {
    lines.push(
      `Participantes confirmados: ${stats.participants}`,
      `Cotas pagas: ${stats.paidQuotas}`,
      "",
      "Acompanhe participantes, cotas e pagamentos:",
    );
  } else if (scope === "GAMES") {
    lines.push(
      poolGamesSummary(stats),
      "",
      "Confira os jogos do bolão:",
    );
  } else {
    lines.push(
      `${stats.participants} ${stats.participants === 1 ? "participante" : "participantes"}`,
      `${stats.paidQuotas} ${stats.paidQuotas === 1 ? "cota" : "cotas"}`,
      poolGamesSummary(stats),
      "",
      "Acompanhe todas as informações do bolão:",
    );
  }

  if (url) lines.push(url);
  return lines.join("\n");
}

export function whatsappShareUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export type ShareResult = "shared" | "cancelled" | "unsupported" | "error";

export function canUseNativeShare() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.share === "function"
  );
}

/** Compartilhamento nativo; distingue sucesso, cancelamento e erro real. */
export async function nativeShare(payload: {
  title: string;
  text: string;
  url?: string | null;
}): Promise<ShareResult> {
  if (!canUseNativeShare()) return "unsupported";
  try {
    await navigator.share({
      title: payload.title,
      text: payload.text,
      ...(payload.url ? { url: payload.url } : {}),
    });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "error";
  }
}

/** Cópia com fallback para ambientes sem clipboard API (preview em iframe). */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // segue para o fallback
  }
  if (typeof document === "undefined") return false;
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function openWhatsApp(message: string): boolean {
  const url = whatsappShareUrl(message);
  if (typeof window === "undefined") return false;
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) return true;
  // Ambiente que bloqueia janelas novas (preview em iframe): tenta navegar.
  try {
    window.location.href = url;
    return true;
  } catch {
    return false;
  }
}
