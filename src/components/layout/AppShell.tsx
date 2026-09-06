import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { appConfig } from "@/config/app.config";
import {
  adminNav,
  desktopNav,
  moreNavItem,
  primaryNav,
  type NavItem,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

function Brand({ className }: { className?: string }) {
  return (
    <Link to="/dashboard" className={cn("flex items-center gap-2", className)}>
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
        {appConfig.logo.monogram}
      </span>
      <span className="font-display text-base font-semibold text-text-primary">
        {appConfig.name}
      </span>
    </Link>
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: (() => void) | undefined }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      activeProps={{ "data-active": "true" }}
      className="flex touch-target items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-sidebar-accent hover:text-text-primary data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary"
    >
      <Icon className="size-4" aria-hidden />
      {item.label}
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <nav className="space-y-5" aria-label="Navegação principal">
      {desktopNav.map((group) => (
        <div key={group.title} className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {group.title}
          </p>
          {group.items.map((item) => (
            <NavLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function AppHeader({ onSignOut }: { onSignOut?: (() => void) | undefined }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle className="text-left">
                <Brand />
              </SheetTitle>
            </SheetHeader>
            <div className="p-3">
              <SidebarNav />
            </div>
          </SheetContent>
        </Sheet>

        <Brand className="lg:hidden" />
        <div className="ml-auto flex items-center gap-1">
          <ThemeSelector />
          {onSignOut ? (
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={onSignOut}>
              <LogOut className="size-5" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function BottomNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = [...primaryNav, moreNavItem];

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex touch-target flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium",
                  active ? "text-sidebar-primary" : "text-text-secondary",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({
  children,
  onSignOut,
}: {
  children: ReactNode;
  onSignOut?: (() => void) | undefined;
}) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border p-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>
        <div className="border-t border-sidebar-border p-3 text-xs text-text-secondary">
          {appConfig.tagline}
        </div>
      </aside>

      <div className="lg:pl-64">
        <AppHeader onSignOut={onSignOut} />
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 lg:pb-10">{children}</main>
      </div>

      <BottomNavigation />
    </div>
  );
}

export { adminNav };
