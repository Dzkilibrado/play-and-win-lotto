/**
 * Fonte única de comportamento do compartilhamento de bolões.
 * Toda ação de compartilhar (nativo, WhatsApp, copiar) usa estas funções —
 * nenhum botão deve montar mensagem ou URL por conta própria.
 */
import type { PoolRow, PoolShareScope } from "@/lib/services/poolService";

export const poolShareScopeLabel: Record<PoolShareScope, string> = {
  PARTICIPANTS: "Participantes e pagamentos",
  GAMES: "Jogos do bolão",
  FULL: "Visão completa",
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
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return null;
  return `${base}/b/${link.token}`;
}

export function poolShareTitle(pool: PoolRow) {
  return `Bolão: ${pool.name}`;
}

/** Mensagem padrão de acompanhamento (com e sem limite de cotas). */
export function poolShareMessage(pool: PoolRow, scope: PoolShareScope, url: string | null): string {
  const contest = pool.contest_number ?? pool.contest_number_planned;
  const intro = scope === "PARTICIPANTS"
    ? `Acompanhe os participantes, cotas e pagamentos do bolão ${pool.name}.`
    : scope === "GAMES"
      ? `Confira os jogos do bolão ${pool.name} para o concurso ${contest ?? "a definir"}.`
      : `Acompanhe todas as informações do bolão ${pool.name}, incluindo participantes e jogos.`;
  const lines = [intro];

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
