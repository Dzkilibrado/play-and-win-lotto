/**
 * Fonte única de comportamento do compartilhamento de bolões.
 * Toda ação de compartilhar (nativo, WhatsApp, copiar) usa estas funções —
 * nenhum botão deve montar mensagem ou URL por conta própria.
 */
import { formatDate } from "@/lib/format";
import { remainingQuotas } from "@/lib/pools/poolMath";
import { isPubliclyVisibleGame } from "@/lib/pools/publicPool";
import type { PoolRow } from "@/lib/services/poolService";

export interface PoolShareStats {
  confirmedParticipants: number;
  paidQuotas: number;
  totalQuotas: number | null;
  availableQuotas: number | null;
  games: number;
}

/** Resumo agregado usado na mensagem, calculado a partir dos participantes. */
export function poolShareStats(pool: PoolRow): PoolShareStats {
  const active = pool.pool_participants.filter((p) => p.status === "ACTIVE");
  const paid = active.filter((p) => p.payment_status === "PAID");
  const quotasTaken = active.reduce((sum, p) => sum + p.quotas, 0);
  return {
    confirmedParticipants: paid.length,
    paidQuotas: paid.reduce((sum, p) => sum + p.quotas, 0),
    totalQuotas: pool.total_quotas,
    availableQuotas: remainingQuotas(pool.total_quotas, quotasTaken),
    games: (pool.pool_games ?? []).filter(
      (link) => link.generated_games && isPubliclyVisibleGame(link.generated_games.status),
    ).length,
  };
}

/** Link público atual do bolão, ou `null` quando o link não está ativo. */
export function poolPublicUrl(pool: PoolRow, origin?: string): string | null {
  if (!pool.is_public || !pool.public_token) return null;
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return null;
  return `${base}/b/${pool.public_token}`;
}

export function poolShareTitle(pool: PoolRow) {
  return `Bolão: ${pool.name}`;
}

/** Mensagem padrão de acompanhamento (com e sem limite de cotas). */
export function poolShareMessage(pool: PoolRow, url: string | null): string {
  const stats = poolShareStats(pool);
  const contest = pool.contest_number ?? pool.contest_number_planned;
  const drawDate = pool.draw_date ?? pool.draw_date_planned;

  const lines = [
    `🎯 Bolão: ${pool.name}`,
    `🎟 ${pool.lotteries?.name ?? "Loteria"}`,
    `🔢 Concurso: ${contest ?? "a definir"}`,
    `📅 Sorteio: ${drawDate ? formatDate(drawDate) : "a definir"}`,
    `👥 Participantes confirmados: ${stats.confirmedParticipants}`,
  ];

  if (stats.totalQuotas === null) {
    lines.push(`🎫 Cotas pagas: ${stats.paidQuotas}`);
    lines.push("♾️ Sem limite de cotas definido");
  } else {
    lines.push(`🎫 Cotas pagas: ${stats.paidQuotas}/${stats.totalQuotas}`);
    lines.push(`🎟 Cotas disponíveis: ${stats.availableQuotas ?? 0}`);
  }

  lines.push(`🎲 Jogos: ${stats.games}`);

  if (url) {
    lines.push("", "Acompanhe o bolão:", url);
  }
  return lines.join("\n");
}

export function whatsappShareUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export type ShareResult = "shared" | "cancelled" | "unsupported" | "error";

export function canUseNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
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
