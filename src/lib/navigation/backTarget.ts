/**
 * Destino do botão "Voltar" de cada tela do aplicativo autenticado.
 * Regra: o destino é sempre a tela "mãe" (previsível, nunca sai do aplicativo).
 * Telas principais (barra inferior) não têm Voltar.
 */
const rootRoutes = new Set(["/dashboard", "/generate", "/games", "/pools", "/more"]);

/** Telas que ficam dentro de "Mais". */
const moreChildren = new Set([
  "/contests",
  "/results",
  "/lotteries",
  "/statistics",
  "/notifications",
  "/profile",
  "/settings",
  "/admin",
]);

export interface BackTarget {
  to: string;
  label: string;
}

const labels: Record<string, string> = {
  "/more": "Mais",
  "/admin": "Administração",
  "/games": "Meus jogos",
  "/pools": "Bolões",
  "/contests": "Concursos",
};

export function backTargetFor(pathname: string): BackTarget | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (rootRoutes.has(path)) return null;
  if (moreChildren.has(path)) return { to: "/more", label: labels["/more"]! };

  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const parent = `/${segments[0]}`;

  if (parent === "/admin") return { to: "/admin", label: labels["/admin"]! };
  // O detalhe do bolão tem o próprio "Voltar à lista", que preserva busca e filtros.
  if (parent === "/pools" && !["new", "list"].includes(segments[1] ?? "")) return null;
  if (parent === "/games" || parent === "/pools" || parent === "/contests") {
    return { to: parent, label: labels[parent]! };
  }
  return null;
}
