/**
 * Navegação entre as seções do bolão.
 *
 * Todas as áreas permanecem textualmente visíveis em cards compactos.
 * A grade usa duas colunas no celular e quatro a partir do tablet.
 */
import {
  Archive,
  FileText,
  History,
  LayoutDashboard,
  Ticket,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PoolSection {
  value: string;
  label: string;
}

const sectionIcons: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  participants: Users,
  games: Ticket,
  finance: Wallet,
  result: Trophy,
  documents: FileText,
  history: History,
  organization: Archive,
};

export function PoolSectionNav({
  sections,
  value,
  onChange,
}: {
  sections: PoolSection[];
  value: string;
  onChange: (value: string) => void;
}) {
  const current = sections.find((section) => section.value === value) ?? sections[0]!;

  return (
    <nav aria-label="Áreas do bolão" className="min-w-0 space-y-2">
      <h2 className="px-0.5 font-display text-sm font-semibold text-text-primary">Áreas do bolão</h2>
      <div
        role="tablist"
        aria-label="Seções do bolão"
        className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4"
      >
        {sections.map((section) => {
          const activeSection = section.value === current?.value;
          const Icon = sectionIcons[section.value] ?? LayoutDashboard;
          return (
            <Button
              key={section.value}
              type="button"
              role="tab"
              variant="ghost"
              aria-selected={activeSection}
              aria-current={activeSection ? "page" : undefined}
              onClick={() => onChange(section.value)}
              className={cn(
                "group relative h-13 min-w-0 justify-start gap-2 overflow-hidden rounded-lg border px-2.5 text-left font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] sm:px-3",
                activeSection
                  ? "border-lottery bg-lottery-soft font-semibold text-lottery shadow-sm after:absolute after:inset-x-5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-lottery"
                  : "border-border bg-surface text-text-primary shadow-sm hover:border-lottery/50 hover:bg-surface-secondary hover:text-lottery",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-md transition-colors",
                  activeSection
                    ? "bg-lottery text-lottery-foreground"
                    : "bg-surface-secondary text-text-secondary group-hover:text-lottery",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 text-xs leading-tight sm:text-sm">{section.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
