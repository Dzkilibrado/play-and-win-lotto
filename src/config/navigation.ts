import {
  BarChart3,
  Bell,
  CalendarDays,
  Camera,

  Home,
  LayoutGrid,
  ListChecks,
  Settings,
  Shield,
  Sparkles,
  Ticket,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { FeatureKey } from "./app.config";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  adminOnly?: boolean;
}

/** Navegação inferior no smartphone. */
export const primaryNav: NavItem[] = [
  { label: "Início", to: "/dashboard", icon: Home },
  { label: "Criar", to: "/generate", icon: Sparkles, feature: "generator" },
  { label: "Meus Jogos", to: "/games", icon: ListChecks },
  { label: "Bolões", to: "/pools", icon: Users, feature: "pools" },
];

/** Itens agrupados em "Mais" no mobile e listados na sidebar no desktop. */
export const secondaryNav: NavItem[] = [
  { label: "Importar por foto", to: "/games/importar", icon: Camera },
  { label: "Concursos e Resultados", to: "/contests", icon: Trophy },
  { label: "Loterias", to: "/lotteries", icon: Ticket },


  { label: "Estatísticas", to: "/statistics", icon: BarChart3, feature: "statistics" },
  { label: "Notificações", to: "/notifications", icon: Bell, feature: "notifications" },
  { label: "Perfil", to: "/profile", icon: User },
  { label: "Configurações", to: "/settings", icon: Settings },
];

export const adminNav: NavItem[] = [
  { label: "Administração", to: "/admin", icon: Shield, adminOnly: true },
];

export const moreNavItem: NavItem = { label: "Mais", to: "/more", icon: LayoutGrid };

export const desktopNav: { title: string; items: NavItem[] }[] = [
  { title: "Principal", items: primaryNav },
  { title: "Consultas", items: secondaryNav.slice(0, 5) },
  { title: "Conta", items: secondaryNav.slice(5) },

  { title: "Sistema", items: adminNav },
];
